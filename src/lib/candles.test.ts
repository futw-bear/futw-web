import { describe, expect, it, vi } from "vitest";

import { downloadCandlesForMarketSession, getCandleDateRange } from "./candles";

const credentials = {
	serverAddress: "https://data.example.com",
	authPassword: "secret-token",
};

describe("candles", () => {
	it("uses intraday candles while the market is open", async () => {
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(JSON.stringify({ isOpen: true, isClose: false }), {
					status: 200,
				});
			}
			return new Response(
				JSON.stringify({
					data: [
						{
							timestamp: "2026-07-14T09:00:00+08:00",
							openPrice: 1025,
							highPrice: 1040,
							lowPrice: 1020,
							closePrice: 1035,
						},
					],
				}),
				{ status: 200 },
			);
		});

		const result = await downloadCandlesForMarketSession({
			code: "2330",
			credentials,
			timeframe: "5",
			fetcher,
			now: new Date("2026-07-14T12:00:00+08:00"),
		});

		expect(result.marketSession).toBe("open");
		expect(result.candles).toEqual([
			{
				time: Date.parse("2026-07-14T09:00:00+08:00"),
				open: 1025,
				high: 1040,
				low: 1020,
				close: 1035,
			},
		]);
		expect(fetcher).toHaveBeenLastCalledWith(
			"https://data.example.com/proxy/market-data/intraday/candles/2330?timeframe=5",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
	});

	it("builds the required historical date ranges in Taiwan time", () => {
		const now = new Date("2026-07-14T12:00:00+08:00");

		expect(getCandleDateRange("1", now)).toBeNull();
		expect(getCandleDateRange("5", now)).toEqual({
			from: "2026-07-07",
			to: "2026-07-14",
		});
		expect(getCandleDateRange("D", now)).toEqual({
			from: "2026-01-15",
			to: "2026-07-14",
		});
		expect(getCandleDateRange("W", now)).toEqual({
			from: "2025-10-14",
			to: "2026-07-14",
		});
		expect(getCandleDateRange("M", now)).toEqual({
			from: "2025-07-15",
			to: "2026-07-14",
		});
	});

	it("requests seven days of minute candles and keeps the first 150 points", async () => {
		const candleRows = Array.from({ length: 160 }, (_, index) => ({
			datetime: new Date(
				Date.parse("2026-07-14T09:00:00+08:00") + index * 60_000,
			).toISOString(),
			open: 100 + index,
			high: 102 + index,
			low: 99 + index,
			close: 101 + index,
		}));
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(JSON.stringify({ isOpen: false, isClose: true }), {
					status: 200,
				});
			}
			return new Response(JSON.stringify(candleRows), { status: 200 });
		});

		const result = await downloadCandlesForMarketSession({
			code: "2330",
			credentials,
			timeframe: "5",
			fetcher,
			now: new Date("2026-07-14T12:00:00+08:00"),
		});

		expect(result.candles).toHaveLength(150);
		expect(result.candles.at(0)?.close).toBe(101);
		expect(result.candles.at(-1)?.close).toBe(250);
		expect(fetcher).toHaveBeenLastCalledWith(
			"https://data.example.com/proxy/market-data/historical/candles/2330?timeframe=5&from=2026-07-07&to=2026-07-14",
			expect.any(Object),
		);
	});

	it("keeps only the latest five trading days for the five-day line chart", async () => {
		const tradingDays = [
			"2026-07-06",
			"2026-07-07",
			"2026-07-08",
			"2026-07-10",
			"2026-07-13",
			"2026-07-14",
		];
		const candleRows = tradingDays.flatMap((date, dayIndex) =>
			["09:00:00", "09:01:00"].map((time, minuteIndex) => ({
				datetime: `${date}T${time}+08:00`,
				open: 100 + dayIndex + minuteIndex,
				high: 102 + dayIndex + minuteIndex,
				low: 99 + dayIndex + minuteIndex,
				close: 101 + dayIndex + minuteIndex,
			})),
		);
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(JSON.stringify({ isOpen: false, isClose: true }), {
					status: 200,
				});
			}
			return new Response(JSON.stringify(candleRows), { status: 200 });
		});

		const result = await downloadCandlesForMarketSession({
			code: "2330",
			credentials,
			timeframe: "1",
			fetcher,
		});

		expect(result.candles).toHaveLength(10);
		expect(result.candles[0]?.time).toBe(
			Date.parse("2026-07-07T09:00:00+08:00"),
		);
		expect(result.candles.at(-1)?.time).toBe(
			Date.parse("2026-07-14T09:01:00+08:00"),
		);
		expect(fetcher).toHaveBeenLastCalledWith(
			"https://data.example.com/proxy/market-data/historical/candles/2330?timeframe=1",
			expect.any(Object),
		);
	});

	it("uses historical candles and date parameters after the market closes", async () => {
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(JSON.stringify({ isOpen: false, isClose: true }), {
					status: 200,
				});
			}
			return new Response(
				JSON.stringify({
					datetime: ["2026-07-14T13:30:00+08:00"],
					Open: [1025],
					High: [1040],
					Low: [1020],
					Close: [1035],
				}),
				{ status: 200 },
			);
		});

		const result = await downloadCandlesForMarketSession({
			code: "2330",
			credentials,
			timeframe: "D",
			from: "2026-07-01",
			to: "2026-07-14",
			fetcher,
		});

		expect(result.marketSession).toBe("closed");
		expect(result.candles).toHaveLength(1);
		expect(fetcher).toHaveBeenLastCalledWith(
			"https://data.example.com/proxy/market-data/historical/candles/2330?timeframe=D&from=2026-07-01&to=2026-07-14",
			expect.any(Object),
		);
	});
});
