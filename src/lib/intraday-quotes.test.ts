import { describe, expect, it, vi } from "vitest";

import {
	downloadIntradayQuote,
	toIntradayQuoteDisplay,
} from "./intraday-quotes";

describe("intraday quotes", () => {
	it("downloads and formats a quote with stored server credentials", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						closePrice: "1,048.50",
						change: "13.50",
						changePercent: "1.30%",
					},
				}),
				{ status: 200 },
			),
		);

		const quote = await downloadIntradayQuote(
			"2330",
			{
				serverAddress: "https://data.example.com/",
				authPassword: "secret-token",
			},
			fetcher,
		);

		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/market-data/intraday/quote/2330",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
		expect(toIntradayQuoteDisplay(quote)).toEqual({
			price: "1,048.50",
			change: "+13.50",
			percent: "+1.30%",
			direction: "gain",
		});
	});
});
