import { describe, expect, it } from "vitest";

import { getPublicApiUrl, InvalidPublicApiServerHostError } from "./api-server";

describe("public API server URLs", () => {
	it("uses same-origin API paths when no host is configured", () => {
		expect(getPublicApiUrl("/api/pub/securities", "")).toBe(
			"/api/pub/securities",
		);
	});

	it("prefixes API paths with the configured server host", () => {
		expect(
			getPublicApiUrl(
				"/api/pub/prices?market=TSE",
				"https://data.example.com/api-gateway/",
			),
		).toBe("https://data.example.com/api-gateway/api/pub/prices?market=TSE");
	});

	it("rejects invalid server hosts", () => {
		expect(() =>
			getPublicApiUrl("/api/pub/securities", "ftp://example.com"),
		).toThrow(InvalidPublicApiServerHostError);
	});
});
