export const SERVER_ADDRESS_STORAGE_KEY = "server-address";
export const AUTH_PASSWORD_STORAGE_KEY = "auth-password";
export const AUTH_CHECK_PATH = "/proxy/market-data/intraday/tickers";

type Fetcher = typeof fetch;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export class InvalidServerAddressError extends Error {
	constructor() {
		super("The server address must be a valid HTTP or HTTPS URL.");
		this.name = "InvalidServerAddressError";
	}
}

export function normalizeServerAddress(serverAddress: string) {
	try {
		const url = new URL(serverAddress.trim());
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new InvalidServerAddressError();
		}
		url.search = "";
		url.hash = "";
		url.pathname = url.pathname.replace(/\/+$/, "");
		return url.toString().replace(/\/$/, "");
	} catch (error) {
		if (error instanceof InvalidServerAddressError) throw error;
		throw new InvalidServerAddressError();
	}
}

export async function authenticateServer({
	serverAddress,
	authPassword,
	fetcher = fetch,
}: {
	serverAddress: string;
	authPassword: string;
	fetcher?: Fetcher;
}) {
	const normalizedServerAddress = normalizeServerAddress(serverAddress);
	const response = await fetcher(
		`${normalizedServerAddress}${AUTH_CHECK_PATH}`,
		{
			method: "GET",
			cache: "no-store",
			headers: {
				accept: "application/json",
				Authorization: `Bearer ${authPassword}`,
			},
		},
	);

	return {
		authenticated: response.status === 200,
		serverAddress: normalizedServerAddress,
	};
}

export function getStoredServerCredentials(
	storage: StorageLike = window.localStorage,
) {
	return {
		serverAddress: storage.getItem(SERVER_ADDRESS_STORAGE_KEY) ?? "",
		authPassword: storage.getItem(AUTH_PASSWORD_STORAGE_KEY) ?? "",
	};
}

export function storeServerCredentials(
	serverAddress: string,
	authPassword: string,
	storage: StorageLike = window.localStorage,
) {
	storage.setItem(SERVER_ADDRESS_STORAGE_KEY, serverAddress);
	storage.setItem(AUTH_PASSWORD_STORAGE_KEY, authPassword);
}
