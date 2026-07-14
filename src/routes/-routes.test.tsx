// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	AUTH_PASSWORD_STORAGE_KEY,
	SERVER_ADDRESS_STORAGE_KEY,
} from "#/lib/server-auth";
import { routeTree } from "../routeTree.gen";

function renderRoute(path: string) {
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ routeTree, history });
	return render(<RouterProvider router={router} />);
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
			{ code: "6233", name: "旺玖", security_type: "Stock" },
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
				Date: "1140705",
				OpeningPrice: 195.95,
				ClosingPrice: 196.8,
			},
		]),
	);
	localStorage.setItem("prices:OTC", "[]");
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("application routes", () => {
	it("uses the watchlist design as the home route", async () => {
		renderRoute("/");

		expect(await screen.findByRole("heading", { name: "自選" })).toBeTruthy();
		expect(screen.getByText("台積電")).toBeTruthy();

		expect(screen.getByText("元大台灣50")).toBeTruthy();
		expect(screen.getByText("鴻海")).toBeTruthy();
		expect(screen.getByText("資料更新於 2025/07/04")).toBeTruthy();
	});

	it("renders a standalone account route", async () => {
		renderRoute("/account");

		expect(await screen.findByRole("heading", { name: "帳戶" })).toBeTruthy();
		expect(screen.getByText("NT$ 842,360")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "檢視明細" }).getAttribute("href"),
		).toBe("/holdings");
	});

	it("authenticates through the account navigation modal", async () => {
		const fetcher = vi
			.spyOn(window, "fetch")
			.mockResolvedValue(new Response("[]", { status: 200 }));
		const { container } = renderRoute("/");
		const page = within(container);

		fireEvent.click(await page.findByRole("link", { name: "帳戶" }));
		const dialog = page.getByRole("dialog", { name: "登入帳戶" });
		const login = within(dialog);
		fireEvent.change(login.getByLabelText("伺服器位址"), {
			target: { value: "https://data.example.com/" },
		});
		fireEvent.change(login.getByLabelText("認證密碼"), {
			target: { value: "secret-token" },
		});
		fireEvent.click(login.getByRole("button", { name: "登入" }));

		await waitFor(() => {
			expect(localStorage.getItem(SERVER_ADDRESS_STORAGE_KEY)).toBe(
				"https://data.example.com",
			);
		});
		expect(localStorage.getItem(AUTH_PASSWORD_STORAGE_KEY)).toBe(
			"secret-token",
		);
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/market-data/intraday/tickers",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
		expect(await page.findByRole("heading", { name: "帳戶" })).toBeTruthy();
	});

	it("searches stored securities by partial ticker and name", async () => {
		const { container } = renderRoute("/search");
		await screen.findByRole("searchbox", { name: "搜尋股票或 ETF" });
		const searchPage = container.querySelector(".search-page");
		expect(searchPage).toBeTruthy();
		const search = within(searchPage as HTMLElement);

		const searchInput = await search.findByRole("searchbox", {
			name: "搜尋股票或 ETF",
		});
		fireEvent.change(searchInput, { target: { value: "233" } });

		expect(await search.findByText("旺玖")).toBeTruthy();
		expect(search.getByText("台積電")).toBeTruthy();
		expect(search.queryByText("上市股熱度榜")).toBeNull();

		fireEvent.change(searchInput, { target: { value: "積電" } });
		expect(await search.findByText("台積電")).toBeTruthy();
		expect(search.queryByText("旺玖")).toBeNull();
	});
});
