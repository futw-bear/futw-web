// @vitest-environment jsdom

import "#/test-dom-setup";
import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	AUTH_PASSWORD_STORAGE_KEY,
	SERVER_ADDRESS_STORAGE_KEY,
} from "#/lib/server-auth";
import { routeTree } from "../routeTree.gen";

const originalWebSocket = globalThis.WebSocket;

function setWebSocket(value: typeof WebSocket | undefined) {
	Object.defineProperty(globalThis, "WebSocket", {
		configurable: true,
		value,
		writable: true,
	});
}

function renderRoute(path: string, previousPath?: string) {
	const history = createMemoryHistory({
		initialEntries: previousPath ? [previousPath, path] : [path],
	});
	const router = createRouter({ routeTree, history });
	return render(<RouterProvider router={router} />);
}

function setInputValue(input: HTMLElement, value: string) {
	fireEvent.focus(input);
	fireEvent.change(input, { target: { value } });
	fireEvent.keyUp(input, { key: value.at(-1) ?? "" });
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
	cleanup();
	vi.useRealTimers();
	setWebSocket(originalWebSocket);
	vi.restoreAllMocks();
});

describe("application routes", () => {
	it("uses the watchlist design as the home route", async () => {
		const { container } = renderRoute("/");
		const page = within(container);

		expect(await page.findByRole("heading", { name: "自選" })).toBeTruthy();
		expect(page.getByText("台積電")).toBeTruthy();

		expect(page.getByText("元大台灣50")).toBeTruthy();
		expect(page.getByText("鴻海")).toBeTruthy();
		expect(page.getByText("資料更新於 2025/07/04")).toBeTruthy();
		expect(page.queryByRole("link", { name: /台積電/ })).toBeNull();
	});

	it("removes stocks while editing the watchlist", async () => {
		const { container } = renderRoute("/");
		const page = within(container);

		fireEvent.click(await page.findByRole("button", { name: "編輯自選" }));
		expect(
			page.getByRole("button", { name: "將台積電移出自選列表" }),
		).toBeTruthy();
		fireEvent.click(page.getByRole("button", { name: "將台積電移出自選列表" }));

		await waitFor(() => expect(page.queryByText("台積電")).toBeNull());
		expect(JSON.parse(localStorage.getItem("watchlist") ?? "[]")).not.toContain(
			"2330",
		);
		expect(page.getByRole("button", { name: "完成編輯" })).toBeTruthy();
	});

	it("uses live watchlist quotes and hides the data hint when authenticated", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const fetcher = vi
			.spyOn(window, "fetch")
			.mockImplementation(async (input) => {
				const code = String(input).split("/").at(-1);
				return new Response(
					JSON.stringify({
						closePrice: code === "2330" ? 1048.5 : Number(code),
						change: code === "2330" ? 13.5 : 0,
						changePercent: code === "2330" ? 1.3 : 0,
					}),
					{ status: 200 },
				);
			});
		const { container } = renderRoute("/");
		const page = within(container);

		expect(page.queryByText(/資料更新於/)).toBeNull();
		expect(await page.findByText("1,048.50")).toBeTruthy();
		expect(page.getByText("+13.50")).toBeTruthy();
		expect(page.getByText("+1.30%")).toBeTruthy();
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/market-data/intraday/quote/2330",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
		expect(
			page.getByRole("link", { name: /台積電/ }).getAttribute("href"),
		).toBe("/stocks/2330");
	});

	it("retries failed initial watchlist quotes five times at ten-second intervals", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const fetcher = vi
			.spyOn(window, "fetch")
			.mockRejectedValue(new Error("Market data unavailable"));
		setWebSocket(undefined);
		const retryDelays: number[] = [];
		const originalSetTimeout = window.setTimeout.bind(window);
		vi.spyOn(window, "setTimeout").mockImplementation(
			(handler: TimerHandler, delay?: number, ...arguments_) => {
				if (delay === 10_000 && typeof handler === "function") {
					retryDelays.push(delay);
					queueMicrotask(() => handler(...arguments_));
					return 1;
				}
				return originalSetTimeout(handler, delay, ...arguments_);
			},
		);

		const { container, unmount } = renderRoute("/");
		const page = within(container);
		await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(36));
		expect(page.getByRole("alert").textContent).toContain(
			"即時行情暫時無法取得",
		);
		expect(retryDelays).toEqual([10_000, 10_000, 10_000, 10_000, 10_000]);
		await act(async () => {});
		expect(fetcher).toHaveBeenCalledTimes(36);

		unmount();
	});

	it("updates watchlist prices and reconnects after a WebSocket error", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		let marketIsClosed = false;
		vi.spyOn(window, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						openPrice: 100,
						closePrice: 101,
						change: 1,
						changePercent: 1,
						isClose: marketIsClosed,
					}),
					{ status: 200 },
				),
		);
		const sockets: MockWebSocket[] = [];
		let socketUrl = "";
		class MockWebSocket {
			close = vi.fn();
			send = vi.fn();
			onclose: (() => void) | null = null;
			onerror: (() => void) | null = null;
			onmessage: ((event: MessageEvent) => void) | null = null;
			onopen: (() => void) | null = null;

			constructor(url: string) {
				socketUrl = url;
				sockets.push(this);
			}
		}
		setWebSocket(MockWebSocket as unknown as typeof WebSocket);

		const { container, unmount } = renderRoute("/");
		const page = within(container);
		await waitFor(() => expect(sockets).toHaveLength(1));
		expect(socketUrl).toBe(
			"wss://data.example.com/proxy/market-data/ws?mode=speed",
		);

		const firstSocket = sockets[0];
		firstSocket.onopen?.();
		expect(firstSocket.send).toHaveBeenCalledWith(
			JSON.stringify({
				event: "subscribe",
				data: {
					channel: "trades",
					symbols: ["2330", "2317", "0050", "2454", "2412", "2884"],
				},
			}),
		);

		firstSocket.onmessage?.(
			new MessageEvent("message", {
				data: JSON.stringify({
					event: "data",
					data: { symbol: "2330", price: 105 },
				}),
			}),
		);
		expect(await page.findByText("105.00")).toBeTruthy();
		expect(page.getByText("+5.00")).toBeTruthy();
		expect(page.getByText("+5.00%")).toBeTruthy();

		vi.useFakeTimers();
		act(() => firstSocket.onerror?.());
		expect(firstSocket.close).toHaveBeenCalled();
		expect(page.getByRole("alert").textContent).toContain(
			"即時行情暫時無法取得",
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});
		expect(sockets).toHaveLength(2);

		const secondSocket = sockets[1];
		act(() => secondSocket.onopen?.());
		expect(secondSocket.send).toHaveBeenCalled();
		expect(page.queryByRole("alert")).toBeNull();

		act(() => secondSocket.onclose?.());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});
		expect(sockets).toHaveLength(3);

		const thirdSocket = sockets[2];
		act(() => thirdSocket.onopen?.());
		marketIsClosed = true;
		act(() => thirdSocket.onclose?.());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});
		expect(sockets).toHaveLength(3);
		expect(page.queryByRole("alert")).toBeNull();

		unmount();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});
		expect(sockets).toHaveLength(3);
	});

	it("requires login when a stock detail URL is opened directly", async () => {
		const fetcher = vi.spyOn(window, "fetch");
		const { container } = renderRoute("/stocks/2330");
		const page = within(container);

		expect((await page.findByRole("alert")).textContent).toContain(
			"請先登入帳戶",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("returns to the previous page from a stock detail", async () => {
		const { container } = renderRoute("/stocks/2330", "/search");
		const page = within(container);

		fireEvent.click(await page.findByRole("button", { name: "返回上一頁" }));

		expect(
			await page.findByRole("searchbox", { name: "搜尋股票或 ETF" }),
		).toBeTruthy();
	});

	it("loads the authenticated stock detail summary from the quote API", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const fetcher = vi
			.spyOn(window, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/intraday/quote/")) {
					return new Response(
						JSON.stringify({
							name: "台積電",
							symbol: "2330",
							closePrice: 1035,
							change: 15,
							changePercent: 1.47,
							highPrice: 1040,
							lowPrice: 1020,
							openPrice: 1025,
							previousClose: 1020,
							isOpen: true,
							isClose: false,
						}),
						{
							status: 200,
						},
					);
				}
				if (url.includes("/intraday/candles/")) {
					return new Response(
						JSON.stringify([
							{
								time: "2026-07-14T09:00:00+08:00",
								open: 1025,
								high: 1040,
								low: 1020,
								close: 1035,
							},
						]),
						{ status: 200 },
					);
				}
				return new Response(
					JSON.stringify({
						name: "台積電",
						symbol: "2330",
						closePrice: 1035,
						change: 15,
						changePercent: 1.47,
						highPrice: 1040,
						lowPrice: 1020,
						openPrice: 1025,
						previousClose: 1020,
					}),
					{ status: 200 },
				);
			});
		const { container } = renderRoute("/stocks/2330");
		const page = within(container);

		expect(await page.findByRole("heading", { name: "台積電" })).toBeTruthy();
		const summary = within(page.getByRole("region", { name: "股票報價" }));
		const favorite = summary.getByRole("button", {
			name: "從自選移除此股票",
		});
		expect(favorite.getAttribute("aria-pressed")).toBe("true");
		expect(favorite.querySelector("svg")?.getAttribute("fill")).toBe(
			"currentColor",
		);
		fireEvent.click(favorite);
		expect(
			summary.getByRole("button", { name: "將此股票加入自選" }),
		).toBeTruthy();
		expect(JSON.parse(localStorage.getItem("watchlist") ?? "[]")).not.toContain(
			"2330",
		);
		expect(summary.getByText("即時報價")).toBeTruthy();
		expect(summary.getByText("1,035.00")).toBeTruthy();
		expect(summary.getByText("+15.00 +1.47%")).toBeTruthy();
		expect(summary.getByText("1,040.00")).toBeTruthy();
		expect(summary.getByText("1,025.00")).toBeTruthy();
		expect(summary.getAllByText("1,020.00")).toHaveLength(2);
		expect(page.queryByRole("combobox", { name: "選擇分鐘 K 線" })).toBeNull();
		for (const minute of ["1", "5", "10", "15", "30", "60"]) {
			expect(page.getByRole("button", { name: `${minute} 分` })).toBeTruthy();
		}
		expect(page.queryByRole("button", { name: "5日" })).toBeNull();
		expect(await page.findByRole("img", { name: "1 分線圖" })).toBeTruthy();
		expect(container.querySelector(".five-day-price-line")).toBeNull();
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/market-data/intraday/quote/2330",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/market-data/intraday/candles/2330?timeframe=1",
			expect.any(Object),
		);
	});

	it("updates an open stock detail quote from WebSocket trades", async () => {
		localStorage.setItem(SERVER_ADDRESS_STORAGE_KEY, "http://data.example.com");
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		vi.spyOn(window, "fetch").mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(
					JSON.stringify({
						name: "台積電",
						symbol: "2330",
						closePrice: 1035,
						highPrice: 1040,
						lowPrice: 1020,
						openPrice: 1025,
						isClose: false,
					}),
					{ status: 200 },
				);
			}
			return new Response("[]", { status: 200 });
		});
		let socket: MockWebSocket | null = null;
		let socketUrl = "";
		class MockWebSocket {
			close = vi.fn();
			send = vi.fn();
			onmessage: ((event: MessageEvent) => void) | null = null;
			onopen: (() => void) | null = null;

			constructor(url: string) {
				socketUrl = url;
				socket = this;
			}
		}
		setWebSocket(MockWebSocket as unknown as typeof WebSocket);

		const { container, unmount } = renderRoute("/stocks/2330");
		const summary = within(
			await within(container).findByRole("region", { name: "股票報價" }),
		);
		await waitFor(() => expect(socket?.onopen).not.toBeNull());
		expect(socketUrl).toBe(
			"ws://data.example.com/proxy/market-data/ws?mode=speed",
		);
		socket?.onopen?.();
		expect(socket?.send).toHaveBeenCalledWith(
			JSON.stringify({
				event: "subscribe",
				data: { channel: "trades", symbols: ["2330"] },
			}),
		);

		socket?.onmessage?.(
			new MessageEvent("message", {
				data: JSON.stringify({
					event: "data",
					data: { symbol: "2330", price: 1050 },
				}),
			}),
		);
		await waitFor(() =>
			expect(summary.getAllByText("1,050.00")).toHaveLength(2),
		);
		expect(summary.getByText("+25.00 +2.44%")).toBeTruthy();
		expect(summary.getAllByText("1,050.00")).toHaveLength(2);
		expect(summary.getByText("1,020.00")).toBeTruthy();

		unmount();
		expect(socket?.close).toHaveBeenCalled();
	});

	it("shows the Taipei close time and the non-watchlist heart state", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		localStorage.setItem("watchlist", JSON.stringify(["2317"]));
		vi.spyOn(window, "fetch").mockImplementation(async (input) => {
			if (String(input).includes("/intraday/quote/")) {
				return new Response(
					JSON.stringify({
						name: "台積電",
						symbol: "2330",
						isOpen: false,
						isClose: true,
						lastUpdated: 1_784_007_045_000_000,
					}),
					{ status: 200 },
				);
			}
			return new Response("[]", { status: 200 });
		});
		const { container } = renderRoute("/stocks/2330");
		const summary = within(
			await within(container).findByRole("region", { name: "股票報價" }),
		);

		expect(
			await summary.findByText("已收盤 07/14 13:30:45（台北）"),
		).toBeTruthy();
		const favorite = summary.getByRole("button", {
			name: "將此股票加入自選",
		});
		expect(favorite.getAttribute("aria-pressed")).toBe("false");
		expect(favorite.querySelector("svg")?.getAttribute("fill")).toBe("none");
	});

	it("uses the five live market index quotes when authenticated", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const closePrices: Record<string, number> = {
			IX0001: 25_123.45,
			IX0043: 275.2,
			IX0027: 1_401.1,
			IX0039: 2_201.2,
			IX0028: 731.8,
		};
		const fetcher = vi
			.spyOn(window, "fetch")
			.mockImplementation(async (input) => {
				const code = String(input).split("/").at(-1) ?? "";
				return new Response(
					JSON.stringify({
						closePrice: closePrices[code],
						change: 10,
						changePercent: 0.5,
					}),
					{ status: 200 },
				);
			});
		const { container } = renderRoute("/market");
		const page = within(container);

		expect(page.queryByText(/資料更新於/)).toBeNull();
		expect(await page.findByText("25,123.45")).toBeTruthy();
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
			"https://data.example.com/proxy/market-data/intraday/quote/IX0001",
			"https://data.example.com/proxy/market-data/intraday/quote/IX0043",
			"https://data.example.com/proxy/market-data/intraday/quote/IX0027",
			"https://data.example.com/proxy/market-data/intraday/quote/IX0039",
			"https://data.example.com/proxy/market-data/intraday/quote/IX0028",
		]);
	});

	it("loads the authenticated account summary and top allocations", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const fetcher = vi.spyOn(window, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [
						{
							stockNo: "2330",
							costPrice: 600,
							tradableQty: 1_000,
							unrealizedProfit: 15_000,
							unrealizedLoss: 0,
						},
						{
							stockNo: "0050",
							costPrice: 200,
							tradableQty: 1_000,
							unrealizedProfit: 0,
							unrealizedLoss: 5_000,
						},
						{
							stockNo: "2412",
							costPrice: 100,
							tradableQty: 1_000,
							unrealizedProfit: 0,
							unrealizedLoss: 0,
						},
						{
							stockNo: "2884",
							costPrice: 50,
							tradableQty: 1_000,
							unrealizedProfit: 0,
							unrealizedLoss: 0,
						},
					],
				}),
				{ status: 200 },
			),
		);
		const { container } = renderRoute("/account");
		const page = within(container);

		expect(await page.findByRole("heading", { name: "帳戶" })).toBeTruthy();
		expect(await page.findByText("NT$ 960,000")).toBeTruthy();
		expect(page.getByText("+10,000")).toBeTruthy();
		expect(page.getByText("+1.05%")).toBeTruthy();
		expect(page.getByText("台積電")).toBeTruthy();
		expect(page.getByText("元大台灣50")).toBeTruthy();
		expect(page.getByText("中華電")).toBeTruthy();
		expect(page.getByText("其餘持股")).toBeTruthy();
		const firstAllocation = container.querySelector(".allocation-row");
		expect(firstAllocation?.querySelector("strong")?.textContent).toBe(
			"台積電",
		);
		expect(firstAllocation?.querySelector("small")?.textContent).toBe("2330");
		expect(page.queryByText("本月損益")).toBeNull();
		expect(
			page.getByRole("link", { name: "檢視明細" }).getAttribute("href"),
		).toBe("/holdings");
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/trading/account-management/unrealized-gains-and-loses",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
	});

	it("shows a login-required state when the account URL is opened directly", async () => {
		const fetcher = vi.spyOn(window, "fetch");
		const { container } = renderRoute("/account");
		const page = within(container);

		expect((await page.findByRole("alert")).textContent).toContain(
			"請先登入帳戶",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("requires login when the holdings URL is opened directly", async () => {
		const fetcher = vi.spyOn(window, "fetch");
		const { container } = renderRoute("/holdings");
		const page = within(container);

		expect((await page.findByRole("alert")).textContent).toContain(
			"請先登入帳戶",
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("loads authenticated holdings and the six-segment detail allocation", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const fetcher = vi.spyOn(window, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [
						{
							stockNo: "2330",
							costPrice: 600,
							tradableQty: 1_000,
							unrealizedProfit: 12_000,
						},
						{
							stockNo: "0050",
							costPrice: 200,
							tradableQty: 1_000,
							unrealizedLoss: 3_000,
						},
						{ stockNo: "2412", costPrice: 100, tradableQty: 1_000 },
						{ stockNo: "2317", costPrice: 80, tradableQty: 1_000 },
						{ stockNo: "2454", costPrice: 60, tradableQty: 1_000 },
						{ stockNo: "2884", costPrice: 50, tradableQty: 1_000 },
					],
				}),
				{ status: 200 },
			),
		);
		const { container } = renderRoute("/holdings");
		const page = within(container);

		expect(await page.findByText("1,099,000")).toBeTruthy();
		const allocationChart = page.getByRole("img", { name: /資產配置/ });
		expect(allocationChart).toBeTruthy();
		expect(allocationChart.getAttribute("style")).toContain("#768E8B");
		expect(allocationChart.getAttribute("style")).toContain("#947D9D");
		expect(
			container.querySelectorAll(".distribution-legend > span"),
		).toHaveLength(6);
		expect(container.querySelectorAll(".holding-row")).toHaveLength(6);
		expect(page.getByText("持有股數")).toBeTruthy();
		expect(page.getByText("損益")).toBeTruthy();
		expect(page.queryByText("餘額")).toBeNull();
		expect(page.getByLabelText("持股資料，可水平捲動")).toBeTruthy();
		const holdingRows = container.querySelectorAll(".holding-row");
		expect(
			holdingRows[0]?.querySelector(".holding-profit-loss")?.textContent,
		).toBe("+12,000（+2.00%）");
		expect(
			holdingRows[0]
				?.querySelector(".holding-profit-loss")
				?.classList.contains("gain"),
		).toBe(true);
		expect(
			holdingRows[1]?.querySelector(".holding-profit-loss")?.textContent,
		).toBe("-3,000（-1.50%）");
		expect(
			holdingRows[1]
				?.querySelector(".holding-profit-loss")
				?.classList.contains("loss"),
		).toBe(true);
		expect(page.getAllByText("台積電")).toHaveLength(2);
		expect(page.getAllByText("聯發科")).toHaveLength(2);
		expect(page.queryByText("富邦台 50")).toBeNull();
		expect(fetcher).toHaveBeenCalledWith(
			"https://data.example.com/proxy/trading/account-management/unrealized-gains-and-loses",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);
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
		setInputValue(
			login.getByLabelText("伺服器位址"),
			"https://data.example.com/",
		);
		setInputValue(login.getByLabelText("認證密碼"), "secret-token");
		fireEvent.click(login.getByRole("button", { name: "登入" }));

		await waitFor(() => {
			expect(localStorage.getItem(SERVER_ADDRESS_STORAGE_KEY)).toBe(
				"https://data.example.com",
			);
			expect(dialog.parentElement?.classList.contains("is-closing")).toBe(true);
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

	it("keeps the login modal mounted until its exit animation ends", async () => {
		const { container } = renderRoute("/");
		const page = within(container);

		fireEvent.click(await page.findByRole("link", { name: "帳戶" }));
		const dialog = page.getByRole("dialog", { name: "登入帳戶" });
		const backdrop = dialog.parentElement as HTMLElement;
		fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

		expect(backdrop.classList.contains("is-closing")).toBe(true);
		expect(page.getByRole("dialog", { hidden: true })).toBeTruthy();
		await act(async () => {
			await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
		});
		expect(page.queryByRole("dialog", { hidden: true })).toBeNull();
	});

	it("opens the account directly when credentials are already stored", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		vi.spyOn(window, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), { status: 200 }),
		);
		const { container } = renderRoute("/");
		const page = within(container);

		fireEvent.click(await page.findByRole("link", { name: "帳戶" }));

		expect(await page.findByRole("heading", { name: "帳戶" })).toBeTruthy();
		expect(page.queryByRole("dialog", { name: "登入帳戶" })).toBeNull();
	});

	it("searches stored securities by partial ticker and name", async () => {
		const { container } = renderRoute("/search");
		const page = within(container);
		await page.findByRole("searchbox", { name: "搜尋股票或 ETF" });
		const searchPage = container.querySelector(".search-page");
		expect(searchPage).toBeTruthy();
		const search = within(searchPage as HTMLElement);

		const searchInput = await search.findByRole("searchbox", {
			name: "搜尋股票或 ETF",
		});
		setInputValue(searchInput, "233");

		expect(await search.findByText("旺玖")).toBeTruthy();
		expect(search.getByText("台積電")).toBeTruthy();
		expect(search.queryByText("上市股熱度榜")).toBeNull();

		setInputValue(searchInput, "積電");
		expect(await search.findByText("台積電")).toBeTruthy();
		expect(search.queryByText("旺玖")).toBeNull();
		expect(search.queryByRole("link", { name: /台積電/ })).toBeNull();
		const favorite = search.getByRole("button", {
			name: "從自選移除台積電",
		});
		expect(favorite.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(favorite);
		expect(
			search.getByRole("button", { name: "將台積電加入自選" }),
		).toBeTruthy();
		expect(JSON.parse(localStorage.getItem("watchlist") ?? "[]")).not.toContain(
			"2330",
		);
	});

	it("links authenticated search results to stock details", async () => {
		localStorage.setItem(
			SERVER_ADDRESS_STORAGE_KEY,
			"https://data.example.com",
		);
		localStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, "secret-token");
		const { container } = renderRoute("/search");
		const search = within(container);

		setInputValue(
			await search.findByRole("searchbox", { name: "搜尋股票或 ETF" }),
			"積電",
		);

		expect(
			(await search.findByRole("link", { name: /台積電/ })).getAttribute(
				"href",
			),
		).toBe("/stocks/2330");
	});
});
