// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { routeTree } from "../routeTree.gen";

function renderRoute(path: string) {
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ routeTree, history });
	render(<RouterProvider router={router} />);
}

describe("application routes", () => {
	it("uses the watchlist design as the home route", async () => {
		renderRoute("/");

		expect(await screen.findByRole("heading", { name: "自選" })).toBeTruthy();
		expect(screen.getByText("台積電")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "ETF" }));

		expect(screen.getByText("元大台灣50")).toBeTruthy();
		expect(screen.queryByText("鴻海")).toBeNull();
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
