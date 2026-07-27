// @vitest-environment jsdom

import "#/test-dom-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RollingNumber } from "./rolling-number";

describe("rolling number", () => {
	it("rolls up for an increase and down for a decrease", () => {
		const { container, rerender } = render(<RollingNumber value="100.00" />);

		rerender(<RollingNumber value="105.00" />);
		const increase = container.querySelector("[data-roll-direction]");
		expect(increase?.getAttribute("data-roll-direction")).toBe("up");

		rerender(<RollingNumber value="103.00" />);
		const rapidDecrease = container.querySelector("[data-roll-direction]");
		expect(rapidDecrease?.getAttribute("data-roll-direction")).toBe("down");
		fireEvent.animationEnd(screen.getByText("103.00"));

		rerender(<RollingNumber value="98.00" />);
		expect(
			container
				.querySelector("[data-roll-direction]")
				?.getAttribute("data-roll-direction"),
		).toBe("down");
		fireEvent.animationEnd(screen.getByText("98.00"));
		expect(screen.getByText("98.00")).toBeTruthy();
	});

	it("does not animate placeholders or numerically unchanged values", () => {
		const { container, rerender } = render(<RollingNumber value="--" />);

		rerender(<RollingNumber value="1,000.00" />);
		expect(container.querySelector("[data-roll-direction]")).toBeNull();

		rerender(<RollingNumber value="1000.00" />);
		expect(container.querySelector("[data-roll-direction]")).toBeNull();
		expect(screen.getByText("1000.00")).toBeTruthy();
	});
});
