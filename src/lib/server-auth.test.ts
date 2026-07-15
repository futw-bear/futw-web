import { describe, expect, it, vi } from "vitest";

import {
	AUTH_CHECK_PATH,
	AUTH_PASSWORD_STORAGE_KEY,
	authenticateServer,
	SERVER_ADDRESS_STORAGE_KEY,
	storeServerCredentials,
} from "./server-auth";

function createMemoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
	};
}

describe("server authentication", () => {
	it("uses the password as a bearer token and accepts only status 200", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response("[]", { status: 200 }));

		const result = await authenticateServer({
			serverAddress: "https://data.example.com/",
			authPassword: "secret-token",
			fetcher,
		});

		expect(result).toEqual({
			authenticated: true,
			serverAddress: "https://data.example.com",
		});
		expect(fetcher).toHaveBeenCalledWith(
			`https://data.example.com${AUTH_CHECK_PATH}`,
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer secret-token",
				}),
			}),
		);

		fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const nonSuccessResult = await authenticateServer({
			serverAddress: "https://data.example.com",
			authPassword: "secret-token",
			fetcher,
		});
		expect(nonSuccessResult.authenticated).toBe(false);
	});

	it("stores credentials under stable localStorage keys", () => {
		const storage = createMemoryStorage();

		storeServerCredentials("https://data.example.com", "secret-token", storage);

		expect(storage.getItem(SERVER_ADDRESS_STORAGE_KEY)).toBe(
			"https://data.example.com",
		);
		expect(storage.getItem(AUTH_PASSWORD_STORAGE_KEY)).toBe("secret-token");
	});
});
