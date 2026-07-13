// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
	getMostRecentTaipeiRefreshAt,
	getNextTaipeiRefreshAt,
} from "./daily-sync";
import {
	SECURITIES_STORAGE_KEY,
	SECURITIES_SYNCED_AT_KEY,
	syncSecuritiesIfDue,
} from "./securities-sync";

function createMemoryStorage() {
	const values = new Map<string, string>();

	return {
		getItem(key: string) {
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		},
	};
}

describe("securities synchronization", () => {
	it("calculates the 08:00 Asia/Taipei refresh boundary", () => {
		expect(
			getMostRecentTaipeiRefreshAt(
				new Date("2026-07-12T23:59:59.000Z"),
			).toISOString(),
		).toBe("2026-07-12T00:00:00.000Z");
		expect(
			getMostRecentTaipeiRefreshAt(
				new Date("2026-07-13T00:00:00.000Z"),
			).toISOString(),
		).toBe("2026-07-13T00:00:00.000Z");
		expect(
			getNextTaipeiRefreshAt(
				new Date("2026-07-13T00:00:00.000Z"),
			).toISOString(),
		).toBe("2026-07-14T00:00:00.000Z");
	});

	it("downloads and combines the requested security types on first entry", async () => {
		const storage = createMemoryStorage();
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([{ code: "2330", name: "台積電", str_mode: 2 }]),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([{ code: "6488", name: "環球晶", str_mode: 4 }]),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				),
			);
		const now = new Date("2026-07-13T00:30:00.000Z");

		await syncSecuritiesIfDue({ now, storage, fetcher });

		expect(fetcher).toHaveBeenCalledWith("/api/pub/securities?type=2", {
			cache: "no-store",
			headers: { accept: "application/json" },
		});
		expect(fetcher).toHaveBeenCalledWith("/api/pub/securities?type=4", {
			cache: "no-store",
			headers: { accept: "application/json" },
		});
		expect(storage.getItem(SECURITIES_STORAGE_KEY)).toBe(
			JSON.stringify([
				{ code: "2330", name: "台積電", str_mode: 2 },
				{ code: "6488", name: "環球晶", str_mode: 4 },
			]),
		);
		expect(storage.getItem(SECURITIES_SYNCED_AT_KEY)).toBe(now.toISOString());
	});

	it("does not download again until the next refresh boundary", async () => {
		const storage = createMemoryStorage();
		storage.setItem(SECURITIES_STORAGE_KEY, "[]");
		storage.setItem(SECURITIES_SYNCED_AT_KEY, "2026-07-13T00:30:00.000Z");
		const fetcher = vi.fn<typeof fetch>().mockImplementation(
			async () =>
				new Response("[]", {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);

		await syncSecuritiesIfDue({
			now: new Date("2026-07-13T12:00:00.000Z"),
			storage,
			fetcher,
		});
		expect(fetcher).not.toHaveBeenCalled();

		await syncSecuritiesIfDue({
			now: new Date("2026-07-14T00:00:00.000Z"),
			storage,
			fetcher,
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
