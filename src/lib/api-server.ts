export const PUBLIC_API_SERVER_HOST =
	import.meta.env.VITE_API_SERVER_HOST?.trim() ?? "";

export class InvalidPublicApiServerHostError extends Error {
	constructor() {
		super("The public API server host must be a valid HTTP or HTTPS URL.");
		this.name = "InvalidPublicApiServerHostError";
	}
}

export function getPublicApiUrl(
	path: string,
	apiServerHost = PUBLIC_API_SERVER_HOST,
) {
	if (!path.startsWith("/")) {
		throw new Error("The public API path must start with '/'.");
	}
	if (!apiServerHost) return path;

	try {
		const url = new URL(apiServerHost);
		const apiPath = new URL(path, "https://public-api.invalid");
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new InvalidPublicApiServerHostError();
		}
		url.search = "";
		url.hash = "";
		url.pathname =
			`${url.pathname.replace(/\/+$/, "")}${apiPath.pathname}`.replace(
				/\/{2,}/g,
				"/",
			);
		url.search = apiPath.search;
		url.hash = apiPath.hash;
		return url.toString();
	} catch (error) {
		if (error instanceof InvalidPublicApiServerHostError) throw error;
		throw new InvalidPublicApiServerHostError();
	}
}
