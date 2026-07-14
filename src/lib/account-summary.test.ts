import { describe, expect, it, vi } from "vitest";

import {
	ACCOUNT_ALLOCATION_COLORS,
	ACCOUNT_OTHER_ALLOCATION_COLOR,
	ACCOUNT_UNREALIZED_GAINS_PATH,
	downloadAccountSummary,
	summarizeAccountPositions,
} from "./account-summary";

const positions = {
	isSuccess: true,
	data: [
		{
			stockNo: "2330",
			stockName: "台積電",
			costPrice: 600,
			tradableQty: 1_000,
			unrealizedProfit: 12_000,
			unrealizedLoss: 0,
		},
		{
			stockNo: "0050",
			stockName: "元大台灣50",
			costPrice: "200",
			tradableQty: "1,000",
			unrealizedProfit: 0,
			unrealizedLoss: 3_000,
		},
		{
			stockNo: "2412",
			stockName: "中華電",
			costPrice: 100,
			tradableQty: 1_000,
			unrealizedProfit: 500,
			unrealizedLoss: 0,
		},
		{
			stockNo: "2884",
			stockName: "玉山金",
			costPrice: 50,
			tradableQty: 1_000,
			unrealizedProfit: 0,
			unrealizedLoss: 100,
		},
	],
};

describe("account summary", () => {
	it("calculates totals and keeps the top three allocations plus the remainder", () => {
		const summary = summarizeAccountPositions(positions);

		expect(summary.totalAssets).toBe(959_400);
		expect(summary.totalCost).toBe(950_000);
		expect(summary.unrealizedProfitLoss).toBe(9_400);
		expect(summary.unrealizedProfitLossRate).toBeCloseTo(0.98947);
		expect(
			summary.allocations.map(({ code, value }) => ({ code, value })),
		).toEqual([
			{ code: "2330", value: 612_000 },
			{ code: "0050", value: 197_000 },
			{ code: "2412", value: 100_500 },
			{ code: "其他", value: 49_900 },
		]);
		expect(summary.allocations[0]?.percentage).toBeCloseTo(63.7899);
		expect(summary.detailAllocations.map(({ code }) => code)).toEqual([
			"2330",
			"0050",
			"2412",
			"2884",
		]);
		expect(summary.holdings[0]).toEqual({
			code: "2330",
			name: "台積電",
			shares: 1_000,
			value: 612_000,
		});
	});

	it("uses the requested fourth and fifth detail chart colors", () => {
		expect(ACCOUNT_ALLOCATION_COLORS[3]).toBe("#768E8B");
		expect(ACCOUNT_ALLOCATION_COLORS[4]).toBe("#947D9D");
		expect(ACCOUNT_OTHER_ALLOCATION_COLOR).toBe("oklch(88% 0.018 70)");
	});

	it("omits the profit and loss rate when the total cost is zero", () => {
		const summary = summarizeAccountPositions({
			data: [
				{
					stockNo: "2330",
					costPrice: 600,
					tradableQty: 0,
					unrealizedProfit: 100,
					unrealizedLoss: 0,
				},
			],
		});

		expect(summary.totalCost).toBe(0);
		expect(summary.unrealizedProfitLossRate).toBeNull();
	});

	it("downloads the account data with the stored bearer credentials", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify(positions), { status: 200 }),
			);

		const summary = await downloadAccountSummary(
			{
				serverAddress: "https://data.example.com/",
				authPassword: "secret-token",
			},
			fetcher,
		);

		expect(summary.totalAssets).toBe(959_400);
		expect(fetcher).toHaveBeenCalledWith(
			`https://data.example.com${ACCOUNT_UNREALIZED_GAINS_PATH}`,
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
	});
});
