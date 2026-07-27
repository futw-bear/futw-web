import { normalizeServerAddress, type ServerCredentials } from "./server-auth";

type Fetcher = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export type IntradayQuote = {
	code: string;
	openPrice: number | null;
	previousClose: number | null;
	closePrice: number | null;
	change: number | null;
	changePercent: number | null;
	isOpen: boolean;
	isClose: boolean;
};

export type IntradayQuoteDisplay = {
	price: string;
	change: string;
	percent: string;
	direction: "gain" | "loss" | "neutral";
};

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasQuoteFields(record: UnknownRecord) {
	return (
		"closePrice" in record ||
		"openPrice" in record ||
		"openingPrice" in record ||
		"previousClose" in record ||
		"change" in record ||
		"changePercent" in record ||
		"isOpen" in record ||
		"isClose" in record
	);
}

function extractQuoteRecord(payload: unknown): UnknownRecord | null {
	if (Array.isArray(payload)) {
		for (const item of payload) {
			const record = extractQuoteRecord(item);
			if (record) return record;
		}
		return null;
	}
	if (!isRecord(payload)) return null;
	if (hasQuoteFields(payload)) return payload;

	for (const field of ["data", "result", "quote"]) {
		const record = extractQuoteRecord(payload[field]);
		if (record) return record;
	}
	return null;
}

function parseNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const parsed = Number(value.replaceAll(",", "").replace("%", "").trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown) {
	return value === true || value === 1 || value === "1" || value === "true";
}

function formatPrice(value: number | null) {
	if (value === null) return "--";
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function formatSigned(value: number | null, suffix = "") {
	if (value === null) return "--";
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

export function toIntradayQuoteDisplay(
	quote: IntradayQuote,
): IntradayQuoteDisplay {
	return {
		price: formatPrice(quote.closePrice),
		change: formatSigned(quote.change),
		percent: formatSigned(quote.changePercent, "%"),
		direction:
			quote.change === null || quote.change === 0
				? "neutral"
				: quote.change > 0
					? "gain"
					: "loss",
	};
}

export async function downloadIntradayQuote(
	code: string,
	credentials: ServerCredentials,
	fetcher: Fetcher = fetch,
): Promise<IntradayQuote> {
	const serverAddress = normalizeServerAddress(credentials.serverAddress);
	const response = await fetcher(
		`${serverAddress}/proxy/market-data/intraday/quote/${encodeURIComponent(code)}`,
		{
			method: "GET",
			cache: "no-store",
			headers: {
				accept: "application/json",
				Authorization: `Bearer ${credentials.authPassword}`,
			},
		},
	);
	if (!response.ok) {
		throw new Error(`Unable to download intraday quote: ${response.status}`);
	}

	const record = extractQuoteRecord(await response.json());
	return {
		code,
		openPrice: parseNumber(record?.openPrice ?? record?.openingPrice),
		previousClose: parseNumber(record?.previousClose),
		closePrice: parseNumber(record?.closePrice),
		change: parseNumber(record?.change),
		changePercent: parseNumber(record?.changePercent),
		isOpen: parseBoolean(record?.isOpen),
		isClose: parseBoolean(record?.isClose),
	};
}

export function downloadIntradayQuotes(
	codes: string[],
	credentials: ServerCredentials,
	fetcher: Fetcher = fetch,
) {
	return Promise.all(
		codes.map((code) => downloadIntradayQuote(code, credentials, fetcher)),
	);
}
