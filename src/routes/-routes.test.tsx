// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { routeTree } from "../routeTree.gen";

function renderRoute(path: string) {
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ routeTree, history });
	render(<RouterProvider router={router} />);
}

beforeEach(() => {
	localStorage.clear();
	localStorage.setItem(
		"securities",
		JSON.stringify([
			{ code: "2330", name: "台積電", security_type: "Stock" },
			{ code: "2317", name: "鴻海", security_type: "Stock" },
			{ code: "0050", name: "元大台灣50", security_type: "ETF" },
			{ code: "2454", name: "聯發科", security_type: "Stock" },
			{ code: "2412", name: "中華電", security_type: "Stock" },
			{ code: "2884", name: "玉山金", security_type: "Stock" },
		]),
	);
	localStorage.setItem(
		"prices:TSE",
		JSON.stringify([
			{
				code: "2330",
				Date: "1140704",
				OpeningPrice: 1025,
				ClosingPrice: 1035,
			},
			{
				code: "2317",
				Date: "1140704",
				OpeningPrice: 208.5,
				ClosingPrice: 212.5,
			},
			{
				code: "0050",
				Date: "1140704",
				OpeningPrice: 195.95,
				ClosingPrice: 196.8,
			},
		]),
	);
	localStorage.setItem("prices:OTC", "[]");
});

describe("application routes", () => {
	it("uses the watchlist design as the home route", async () => {
		renderRoute("/");

		expect(await screen.findByRole("heading", { name: "自選" })).toBeTruthy();
		expect(screen.getByText("台積電")).toBeTruthy();

		expect(screen.getByText("元大台灣50")).toBeTruthy();
		expect(screen.getByText("鴻海")).toBeTruthy();
	});

	it("renders a standalone account route", async () => {
		renderRoute("/account");

		expect(await screen.findByRole("heading", { name: "帳戶" })).toBeTruthy();
		expect(screen.getByText("NT$ 842,360")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "檢視明細" }).getAttribute("href"),
		).toBe("/holdings");
	});
});
