import { normalizeServerAddress, type ServerCredentials } from "./server-auth";

type Fetcher = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export type StockQuote = {
	name: string;
	symbol: string;
	closePrice: string;
	change: string;
	changePercent: string;
	highPrice: string;
	lowPrice: string;
	openPrice: string;
	previousClose: string;
	direction: "gain" | "loss" | "neutral";
};

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasQuoteFields(record: UnknownRecord) {
	return "symbol" in record || "closePrice" in record;
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

function formatPrice(value: unknown) {
	const number = parseNumber(value);
	if (number === null) return "--";
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(number);
}

function formatSigned(value: number | null, suffix = "") {
	if (value === null) return "--";
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function normalizeText(value: unknown, fallback: string) {
	if (typeof value !== "string" && typeof value !== "number") return fallback;
	return String(value).trim() || fallback;
}

export async function downloadStockQuote(
	code: string,
	credentials: ServerCredentials,
	fetcher: Fetcher = fetch,
): Promise<StockQuote> {
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
		throw new Error(`Unable to download stock quote: ${response.status}`);
	}

	const record = extractQuoteRecord(await response.json());
	if (!record) throw new Error("Unable to parse stock quote response.");
	const change = parseNumber(record.change);

	return {
		name: normalizeText(record.name, code),
		symbol: normalizeText(record.symbol, code),
		closePrice: formatPrice(record.closePrice),
		change: formatSigned(change),
		changePercent: formatSigned(parseNumber(record.changePercent), "%"),
		highPrice: formatPrice(record.highPrice),
		lowPrice: formatPrice(record.lowPrice),
		openPrice: formatPrice(record.openPrice),
		previousClose: formatPrice(record.previousClose),
		direction:
			change === null || change === 0
				? "neutral"
				: change > 0
					? "gain"
					: "loss",
	};
}
