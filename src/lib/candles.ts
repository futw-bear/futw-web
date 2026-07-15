import { downloadIntradayQuote } from "./intraday-quotes";
import { normalizeServerAddress, type ServerCredentials } from "./server-auth";

type Fetcher = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export const MINUTE_TIMEFRAMES = ["1", "5", "10", "15", "30", "60"] as const;
export type MinuteTimeframe = (typeof MINUTE_TIMEFRAMES)[number];
export const CANDLE_MINUTE_TIMEFRAMES = ["5", "10", "15", "30", "60"] as const;
export type CandleMinuteTimeframe = (typeof CANDLE_MINUTE_TIMEFRAMES)[number];
export type CandleTimeframe = MinuteTimeframe | "D" | "W" | "M";
export type MarketSession = "open" | "closed";

export type Candle = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
};

type DownloadCandlesOptions = {
	code: string;
	credentials: ServerCredentials;
	timeframe: CandleTimeframe;
	from?: string;
	to?: string;
	fetcher?: Fetcher;
	now?: Date;
};

const TIME_FIELDS = [
	"time",
	"timestamp",
	"datetime",
	"dateTime",
	"date",
	"startTime",
	"Date",
];
const OPEN_FIELDS = ["open", "openPrice", "Open"];
const HIGH_FIELDS = ["high", "highPrice", "High"];
const LOW_FIELDS = ["low", "lowPrice", "Low"];
const CLOSE_FIELDS = ["close", "closePrice", "Close"];
const COLLECTION_FIELDS = ["data", "items", "candles", "result", "results"];
const TAIPEI_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Taipei",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(record: UnknownRecord, fields: string[]) {
	for (const field of fields) {
		const value = record[field];
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return undefined;
}

function hasCandleFields(record: UnknownRecord) {
	return (
		!Array.isArray(firstValue(record, OPEN_FIELDS)) &&
		!Array.isArray(firstValue(record, HIGH_FIELDS)) &&
		!Array.isArray(firstValue(record, LOW_FIELDS)) &&
		!Array.isArray(firstValue(record, CLOSE_FIELDS)) &&
		firstValue(record, OPEN_FIELDS) !== undefined &&
		firstValue(record, HIGH_FIELDS) !== undefined &&
		firstValue(record, LOW_FIELDS) !== undefined &&
		firstValue(record, CLOSE_FIELDS) !== undefined
	);
}

function extractCandleRecords(payload: unknown): UnknownRecord[] {
	if (Array.isArray(payload)) return payload.flatMap(extractCandleRecords);
	if (!isRecord(payload)) return [];
	if (hasCandleFields(payload)) return [payload];

	for (const field of COLLECTION_FIELDS) {
		if (field in payload) {
			const records = extractCandleRecords(payload[field]);
			if (records.length > 0) return records;
		}
	}
	return [];
}

function parseNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const parsed = Number(value.replaceAll(",", "").trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function parseTime(value: unknown) {
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return null;
		return value < 1_000_000_000_000 ? value * 1000 : value;
	}
	if (typeof value !== "string") return null;
	const input = value.trim();
	if (!input) return null;
	if (/^\d+$/.test(input)) return parseTime(Number(input));
	const parsed = Date.parse(input);
	return Number.isNaN(parsed) ? null : parsed;
}

function parseCandleRecord(record: UnknownRecord): Candle | null {
	const time = parseTime(firstValue(record, TIME_FIELDS));
	const open = parseNumber(firstValue(record, OPEN_FIELDS));
	const high = parseNumber(firstValue(record, HIGH_FIELDS));
	const low = parseNumber(firstValue(record, LOW_FIELDS));
	const close = parseNumber(firstValue(record, CLOSE_FIELDS));
	return time === null ||
		open === null ||
		high === null ||
		low === null ||
		close === null
		? null
		: { time, open, high, low, close };
}

function parseColumnarCandles(record: UnknownRecord): Candle[] {
	const times = firstValue(record, TIME_FIELDS);
	const opens = firstValue(record, OPEN_FIELDS);
	const highs = firstValue(record, HIGH_FIELDS);
	const lows = firstValue(record, LOW_FIELDS);
	const closes = firstValue(record, CLOSE_FIELDS);
	if (
		!Array.isArray(times) ||
		!Array.isArray(opens) ||
		!Array.isArray(highs) ||
		!Array.isArray(lows) ||
		!Array.isArray(closes)
	) {
		return [];
	}

	const candleCount = Math.min(
		times.length,
		opens.length,
		highs.length,
		lows.length,
		closes.length,
	);
	return Array.from({ length: candleCount }, (_, index) =>
		parseCandleRecord({
			time: times[index],
			open: opens[index],
			high: highs[index],
			low: lows[index],
			close: closes[index],
		}),
	).filter((candle): candle is Candle => candle !== null);
}

function extractColumnarCandles(payload: unknown): Candle[] {
	if (Array.isArray(payload)) return payload.flatMap(extractColumnarCandles);
	if (!isRecord(payload)) return [];
	const candles = parseColumnarCandles(payload);
	if (candles.length > 0) return candles;

	for (const field of COLLECTION_FIELDS) {
		if (field in payload) {
			const nestedCandles = extractColumnarCandles(payload[field]);
			if (nestedCandles.length > 0) return nestedCandles;
		}
	}
	return [];
}

function sortAndDedupeCandles(candles: Candle[]) {
	const candlesByTime = new Map<number, Candle>();
	for (const candle of candles) candlesByTime.set(candle.time, candle);
	return [...candlesByTime.values()].sort(
		(left, right) => left.time - right.time,
	);
}

function getTaipeiDate(now: Date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const getPart = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	return new Date(
		Date.UTC(getPart("year"), getPart("month") - 1, getPart("day")),
	);
}

function shiftUtcMonths(date: Date, months: number) {
	const shifted = new Date(date);
	const originalDay = shifted.getUTCDate();
	shifted.setUTCDate(1);
	shifted.setUTCMonth(shifted.getUTCMonth() + months);
	const lastDay = new Date(
		Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
	).getUTCDate();
	shifted.setUTCDate(Math.min(originalDay, lastDay));
	return shifted;
}

function formatDate(date: Date) {
	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("-");
}

export function getCandleDateRange(
	timeframe: CandleTimeframe,
	now = new Date(),
): { from: string; to: string } | null {
	if (timeframe === "1") return null;
	const toDate = getTaipeiDate(now);
	let fromDate: Date;
	if (CANDLE_MINUTE_TIMEFRAMES.includes(timeframe as CandleMinuteTimeframe)) {
		fromDate = new Date(toDate);
		fromDate.setUTCDate(fromDate.getUTCDate() - 7);
	} else if (timeframe === "D" || timeframe === "M") {
		fromDate = new Date(toDate);
		fromDate.setUTCDate(
			fromDate.getUTCDate() - (timeframe === "D" ? 180 : 364),
		);
	} else {
		fromDate = shiftUtcMonths(toDate, -9);
	}
	return { from: formatDate(fromDate), to: formatDate(toDate) };
}

function constrainCandles(
	candles: Candle[],
	timeframe: CandleTimeframe,
	range: { from: string; to: string } | null,
) {
	if (timeframe === "1") {
		const tradingDays = [
			...new Set(
				candles.map((candle) =>
					TAIPEI_DAY_FORMATTER.format(new Date(candle.time)),
				),
			),
		];
		const visibleDays = new Set(tradingDays.slice(-5));
		return candles.filter((candle) =>
			visibleDays.has(TAIPEI_DAY_FORMATTER.format(new Date(candle.time))),
		);
	}
	if (!CANDLE_MINUTE_TIMEFRAMES.includes(timeframe as CandleMinuteTimeframe)) {
		return candles;
	}
	let constrained = candles;
	if (range) {
		const fromTime = Date.parse(`${range.from}T00:00:00+08:00`);
		const toTime = Date.parse(`${range.to}T23:59:59.999+08:00`);
		constrained = candles.filter(
			(candle) => candle.time >= fromTime && candle.time <= toTime,
		);
	}
	return constrained.slice(0, 150);
}

export function parseCandles(payload: unknown): Candle[] {
	const columnarCandles = extractColumnarCandles(payload);
	if (columnarCandles.length > 0) {
		return sortAndDedupeCandles(columnarCandles);
	}

	const candles = extractCandleRecords(payload)
		.map(parseCandleRecord)
		.filter((candle): candle is Candle => candle !== null);

	return sortAndDedupeCandles(candles);
}

export async function downloadCandlesForMarketSession({
	code,
	credentials,
	timeframe,
	from,
	to,
	fetcher = fetch,
	now = new Date(),
}: DownloadCandlesOptions): Promise<{
	candles: Candle[];
	marketSession: MarketSession;
}> {
	const quote = await downloadIntradayQuote(code, credentials, fetcher);
	const isMinuteTimeframe = MINUTE_TIMEFRAMES.includes(
		timeframe as MinuteTimeframe,
	);
	const isMarketOpen = !quote.isClose;
	if (isMarketOpen && !isMinuteTimeframe) {
		throw new Error("Open-market candles require a minute timeframe.");
	}

	const marketSession: MarketSession = isMarketOpen ? "open" : "closed";
	const path = isMarketOpen
		? "/proxy/market-data/intraday/candles"
		: "/proxy/market-data/historical/candles";
	const defaultRange = getCandleDateRange(timeframe, now);
	const range = defaultRange
		? { from: from ?? defaultRange.from, to: to ?? defaultRange.to }
		: null;
	const parameters = new URLSearchParams({ timeframe });
	if (!isMarketOpen && range) parameters.set("from", range.from);
	if (!isMarketOpen && range) parameters.set("to", range.to);
	const serverAddress = normalizeServerAddress(credentials.serverAddress);
	const response = await fetcher(
		`${serverAddress}${path}/${encodeURIComponent(code)}?${parameters}`,
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
		throw new Error(`Unable to download candles: ${response.status}`);
	}

	return {
		candles: constrainCandles(
			parseCandles(await response.json()),
			timeframe,
			range,
		),
		marketSession,
	};
}
