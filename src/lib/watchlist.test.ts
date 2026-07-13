// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
	DEFAULT_WATCHLIST,
	getStoredWatchlist,
	getWatchlistStocks,
	WATCHLIST_STORAGE_KEY,
} from "./watchlist";

function createMemoryStorage(initialValues: Record<string, string> = {}) {
	const values = new Map(Object.entries(initialValues));

	return {
		getItem(key: string) {
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		},
	};
}

describe("watchlist storage", () => {
	it("stores the six default tickers when no watchlist exists", () => {
		const storage = createMemoryStorage();

		expect(getStoredWatchlist(storage)).toEqual(DEFAULT_WATCHLIST);
		expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe(
			JSON.stringify(DEFAULT_WATCHLIST),
		);
	});

	it("preserves an intentionally empty watchlist", () => {
		const storage = createMemoryStorage({
			[WATCHLIST_STORAGE_KEY]: "[]",
		});

		expect(getStoredWatchlist(storage)).toEqual([]);
	});

	it("joins names and TSE prices from localStorage", () => {
		const storage = createMemoryStorage({
			[WATCHLIST_STORAGE_KEY]: JSON.stringify(["2330", "0050"]),
			securities: JSON.stringify({
				data: [
					{ code: "2330", name: "台積電", security_type: "Stock" },
					{ code: "0050", name: "元大台灣50", security_type: "ETF" },
				],
			}),
			"prices:TSE": JSON.stringify([
				{
					Code: "2330",
					Date: "1140704",
					price: "999.00",
					OpeningPrice: "1,025.00",
					ClosingPrice: "1,035.00",
					change: "99.00",
					Change: "+15.00",
				},
				{
					Code: "0050",
					Date: "2025-07-04",
					OpeningPrice: "197.65",
					ClosingPrice: "196.80",
					Change: "0.85",
				},
			]),
			"prices:OTC": "[]",
		});

		expect(getWatchlistStocks(storage)).toEqual([
			expect.objectContaining({
				ticker: "2330",
				name: "台積電",
				date: "2025/07/04",
				price: "1,035.00",
				change: "+10.00",
				percent: "+0.98%",
				direction: "gain",
				kind: "證券",
			}),
			expect.objectContaining({
				ticker: "0050",
				name: "元大台灣50",
				price: "196.80",
				kind: "ETF",
			}),
		]);
	});

	it("supports ticker-keyed OTC price objects", () => {
		const storage = createMemoryStorage({
			[WATCHLIST_STORAGE_KEY]: JSON.stringify(["6488"]),
			securities: JSON.stringify({
				"6488": { Name: "環球晶", SecurityType: "Stock" },
			}),
			"prices:TSE": "[]",
			"prices:OTC": JSON.stringify({
				"6488": {
					Date: "1140704",
					ClosingPrice: 999,
					Open: 476,
					Close: 472.5,
					Change: 99,
					Cange: 88,
				},
			}),
		});

		expect(getWatchlistStocks(storage)[0]).toEqual(
			expect.objectContaining({
				ticker: "6488",
				name: "環球晶",
				date: "2025/07/04",
				price: "472.50",
				change: "-3.50",
				percent: "-0.74%",
				direction: "loss",
			}),
		);
	});
});
