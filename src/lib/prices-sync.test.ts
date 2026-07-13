// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
	getMostRecentTaipeiRefreshAt,
	getNextTaipeiRefreshAt,
} from "./daily-sync";
import {
	getPricesStorageKey,
	PRICES_SYNCED_AT_KEY,
	syncPricesIfDue,
} from "./prices-sync";

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

describe("last business day price synchronization", () => {
	it("calculates the 14:00 Asia/Taipei refresh boundary", () => {
		expect(
			getMostRecentTaipeiRefreshAt(
				new Date("2026-07-13T05:59:59.000Z"),
				14,
			).toISOString(),
		).toBe("2026-07-12T06:00:00.000Z");
		expect(
			getMostRecentTaipeiRefreshAt(
				new Date("2026-07-13T06:00:00.000Z"),
				14,
			).toISOString(),
		).toBe("2026-07-13T06:00:00.000Z");
		expect(
			getNextTaipeiRefreshAt(
				new Date("2026-07-13T06:00:00.000Z"),
				14,
			).toISOString(),
		).toBe("2026-07-14T06:00:00.000Z");
	});

	it("downloads TSE and OTC prices on first entry", async () => {
		const storage = createMemoryStorage();
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const market = String(input).includes("market=TSE") ? "TSE" : "OTC";
			return new Response(JSON.stringify([{ market, code: "2330" }]), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		const now = new Date("2026-07-13T06:30:00.000Z");

		await syncPricesIfDue({ now, storage, fetcher });

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher).toHaveBeenCalledWith(
			"/api/pub/prices?market=TSE",
			expect.objectContaining({ cache: "no-store" }),
		);
		expect(fetcher).toHaveBeenCalledWith(
			"/api/pub/prices?market=OTC",
			expect.objectContaining({ cache: "no-store" }),
		);
		expect(storage.getItem(getPricesStorageKey("TSE"))).toBe(
			JSON.stringify([{ market: "TSE", code: "2330" }]),
		);
		expect(storage.getItem(getPricesStorageKey("OTC"))).toBe(
			JSON.stringify([{ market: "OTC", code: "2330" }]),
		);
		expect(storage.getItem(PRICES_SYNCED_AT_KEY)).toBe(now.toISOString());
	});

	it("does not download again before the next 14:00 boundary", async () => {
		const storage = createMemoryStorage();
		storage.setItem(getPricesStorageKey("TSE"), "[]");
		storage.setItem(getPricesStorageKey("OTC"), "[]");
		storage.setItem(PRICES_SYNCED_AT_KEY, "2026-07-13T06:30:00.000Z");
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
			return new Response("[]", {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		await syncPricesIfDue({
			now: new Date("2026-07-13T12:00:00.000Z"),
			storage,
			fetcher,
		});
		expect(fetcher).not.toHaveBeenCalled();

		await syncPricesIfDue({
			now: new Date("2026-07-14T06:00:00.000Z"),
			storage,
			fetcher,
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
