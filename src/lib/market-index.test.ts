import { describe, expect, it, vi } from "vitest";

import {
	downloadIntradayMarketIndexes,
	downloadMarketIndexes,
	INTRADAY_MARKET_INDEXES,
	OTC_MARKET_INDEX_API_URL,
	TSE_MARKET_INDEX_API_URL,
} from "./market-index";

describe("market indexes", () => {
	it("maps authenticated intraday quotes to the required index codes", async () => {
		const values = new Map(
			INTRADAY_MARKET_INDEXES.map(({ code }, index) => [
				code,
				{
					closePrice: 25_000 + index,
					change: index + 1,
					changePercent: (index + 1) / 10,
				},
			]),
		);
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const code = String(input).split("/").at(-1) ?? "";
			return new Response(JSON.stringify(values.get(code)), { status: 200 });
		});

		const indexes = await downloadIntradayMarketIndexes(
			{
				serverAddress: "https://data.example.com",
				authPassword: "secret-token",
			},
			fetcher,
		);

		expect(indexes.map(({ name }) => name)).toEqual([
			"加權指數",
			"櫃買指數",
			"電子指數",
			"金融指數",
			"半導體指數",
		]);
		expect(indexes[0]).toEqual(
			expect.objectContaining({
				value: "25,000.00",
				change: "+1.00",
				percent: "+0.10%",
			}),
		);
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual(
			INTRADAY_MARKET_INDEXES.map(
				({ code }) =>
					`https://data.example.com/proxy/market-data/intraday/quote/${code}`,
			),
		);
	});

	it("maps TSE indexes and selects the newest OTC record", async () => {
		const tsePayload = [
			{
				指數: "發行量加權股價指數",
				日期: "1150714",
				收盤指數: "23,184.62",
				"漲跌(+/-)": "+",
				漲跌點數: "111.04",
				漲跌百分比: "0.48",
			},
			{
				指數: "電子工業類指數",
				日期: "1150714",
				收盤指數: "1,286.70",
				漲跌點數: "9.20",
			},
			{
				指數: "金融保險類指數",
				日期: "1150714",
				收盤指數: "2,148.30",
				漲跌點數: "4.50",
			},
			{
				指數: "半導體類指數",
				日期: "1150714",
				收盤指數: "682.90",
				漲跌點數: "7.43",
			},
		];
		const otcPayload = [
			{ Date: "115/07/12", Close: "275.10", Change: "-0.90" },
			{ Date: "115/07/13", Close: "276.84", Change: "-0.50" },
		];
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const payload = String(input).includes("market=OTC")
				? otcPayload
				: tsePayload;
			return new Response(JSON.stringify(payload), { status: 200 });
		});

		const indexes = await downloadMarketIndexes(fetcher);

		expect(fetcher).toHaveBeenCalledWith(TSE_MARKET_INDEX_API_URL, {
			cache: "no-store",
			headers: { accept: "application/json" },
		});
		expect(fetcher).toHaveBeenCalledWith(OTC_MARKET_INDEX_API_URL, {
			cache: "no-store",
			headers: { accept: "application/json" },
		});
		expect(indexes.map(({ name }) => name)).toEqual([
			"加權指數",
			"櫃買指數",
			"電子指數",
			"金融指數",
			"半導體指數",
		]);
		expect(indexes[0]).toEqual(
			expect.objectContaining({
				date: "2026/07/14",
				value: "23,184.62",
				change: "+111.04",
				percent: "+0.48%",
			}),
		);
		expect(indexes[1]).toEqual(
			expect.objectContaining({
				date: "2026/07/13",
				value: "276.84",
			}),
		);
	});
});
