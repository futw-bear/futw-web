import { describe, expect, it, vi } from "vitest";

import { downloadStockQuote } from "./stock-quote";

describe("stock quote", () => {
	it("downloads and maps all stock summary fields", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						name: "台積電",
						symbol: "2330",
						closePrice: 1035,
						change: 15,
						changePercent: 1.47,
						highPrice: 1040,
						lowPrice: 1020,
						openPrice: 1025,
						previousClose: 1020,
					},
				}),
				{ status: 200 },
			),
		);

		const quote = await downloadStockQuote(
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
		expect(quote).toEqual({
			name: "台積電",
			symbol: "2330",
			closePrice: "1,035.00",
			change: "+15.00",
			changePercent: "+1.47%",
			highPrice: "1,040.00",
			lowPrice: "1,020.00",
			openPrice: "1,025.00",
			previousClose: "1,020.00",
			direction: "gain",
		});
	});
});
