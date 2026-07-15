import { getPublicApiUrl } from "./api-server";
import {
	downloadIntradayQuotes,
	toIntradayQuoteDisplay,
} from "./intraday-quotes";
import type { ServerCredentials } from "./server-auth";

export const TSE_MARKET_INDEX_API_URL = getPublicApiUrl(
	"/api/pub/market_index?market=TSE",
);
export const OTC_MARKET_INDEX_API_URL = getPublicApiUrl(
	"/api/pub/market_index?market=OTC",
);

type Fetcher = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export type MarketIndex = {
	name: string;
	date: string;
	value: string;
	change: string;
	percent: string;
	direction: "gain" | "loss" | "neutral";
	compact: boolean;
};

type CalendarDate = {
	year: number;
	month: number;
	day: number;
};

const INDEX_NAME_FIELDS = ["指數", "指數名稱", "name", "Name", "IndexName"];
const DATE_FIELDS = ["Date", "date", "日期", "資料日期", "__dataDate"];
const VALUE_FIELDS = [
	"收盤指數",
	"收盤價",
	"指數值",
	"Close",
	"close",
	"ClosingIndex",
];
const CHANGE_FIELDS = ["漲跌點數", "漲跌", "Change", "change"];
const CHANGE_SIGN_FIELDS = ["漲跌(+/-)", "漲跌(+／-)", "漲跌符號"];
const PERCENT_FIELDS = [
	"漲跌百分比",
	"漲跌百分比(%)",
	"漲跌幅",
	"漲跌幅(%)",
	"ChangePercent",
	"changePercent",
	"ChangeRate",
];
const COLLECTION_FIELDS = ["data", "items", "result", "results", "indexes"];

const TSE_INDEXES = [
	{
		name: "加權指數",
		sourceName: "發行量加權股價指數",
		compact: false,
	},
	{ name: "電子指數", sourceName: "電子工業類指數", compact: true },
	{ name: "金融指數", sourceName: "金融保險類指數", compact: true },
	{ name: "半導體指數", sourceName: "半導體類指數", compact: true },
] as const;

export const INTRADAY_MARKET_INDEXES = [
	{ name: "加權指數", code: "IX0001", compact: false },
	{ name: "櫃買指數", code: "IX0043", compact: false },
	{ name: "電子指數", code: "IX0027", compact: true },
	{ name: "金融指數", code: "IX0039", compact: true },
	{ name: "半導體指數", code: "IX0028", compact: true },
] as const;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(record: UnknownRecord | undefined, fields: string[]) {
	if (!record) return undefined;
	for (const field of fields) {
		const value = record[field];
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return undefined;
}

function hasMarketValue(record: UnknownRecord) {
	return (
		firstValue(record, INDEX_NAME_FIELDS) !== undefined ||
		firstValue(record, VALUE_FIELDS) !== undefined
	);
}

function extractRecords(
	value: unknown,
	inheritedDate?: unknown,
): UnknownRecord[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => extractRecords(item, inheritedDate));
	}
	if (!isRecord(value)) return [];

	const ownDate = firstValue(value, DATE_FIELDS) ?? inheritedDate;
	if (hasMarketValue(value)) {
		return ownDate === undefined || firstValue(value, DATE_FIELDS) !== undefined
			? [value]
			: [{ ...value, __dataDate: ownDate }];
	}

	for (const field of COLLECTION_FIELDS) {
		if (field in value) return extractRecords(value[field], ownDate);
	}
	return [];
}

function parseNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.replaceAll(",", "").replace("%", "").trim();
	if (!normalized || normalized === "--") return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function getSignedChange(record: UnknownRecord | undefined) {
	const change = parseNumber(firstValue(record, CHANGE_FIELDS));
	if (change === null) return null;
	const sign = String(firstValue(record, CHANGE_SIGN_FIELDS) ?? "");
	if (sign.includes("-") || sign.includes("－")) return -Math.abs(change);
	if (sign.includes("+") || sign.includes("＋")) return Math.abs(change);
	return change;
}

function isValidDate({ year, month, day }: CalendarDate) {
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function parseDate(value: unknown): CalendarDate | null {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const input = String(value).trim().split("T")[0] ?? "";
	const match = input.match(/^(\d{3,4})[/-]?(\d{2})[/-]?(\d{2})$/);
	if (!match) return null;
	const rawYear = Number(match[1]);
	const date = {
		year: rawYear < 1000 ? rawYear + 1911 : rawYear,
		month: Number(match[2]),
		day: Number(match[3]),
	};
	return isValidDate(date) ? date : null;
}

function getDateKey(date: CalendarDate | null) {
	return date ? date.year * 10000 + date.month * 100 + date.day : -1;
}

function formatDate(date: CalendarDate | null) {
	if (!date) return "--";
	return `${date.year}/${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")}`;
}

function formatValue(value: number | null) {
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

function toMarketIndex(
	name: string,
	record: UnknownRecord | undefined,
	compact: boolean,
): MarketIndex {
	const value = parseNumber(firstValue(record, VALUE_FIELDS));
	const change = getSignedChange(record);
	const storedPercent = parseNumber(firstValue(record, PERCENT_FIELDS));
	const previousValue =
		value !== null && change !== null ? value - change : null;
	const percent =
		storedPercent ??
		(previousValue !== null && previousValue !== 0 && change !== null
			? (change / previousValue) * 100
			: null);
	return {
		name,
		date: formatDate(parseDate(firstValue(record, DATE_FIELDS))),
		value: formatValue(value),
		change: formatSigned(change),
		percent: formatSigned(percent, "%"),
		direction:
			change === null || change === 0
				? "neutral"
				: change > 0
					? "gain"
					: "loss",
		compact,
	};
}

async function downloadJson(fetcher: Fetcher, url: string) {
	const response = await fetcher(url, {
		cache: "no-store",
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`Unable to download market indexes: ${response.status}`);
	}
	return response.json() as Promise<unknown>;
}

export async function downloadMarketIndexes(
	fetcher: Fetcher = fetch,
): Promise<MarketIndex[]> {
	const [tsePayload, otcPayload] = await Promise.all([
		downloadJson(fetcher, TSE_MARKET_INDEX_API_URL),
		downloadJson(fetcher, OTC_MARKET_INDEX_API_URL),
	]);
	const tseRecords = extractRecords(tsePayload);
	const otcRecords = extractRecords(otcPayload);
	const tseIndexes = TSE_INDEXES.map(({ name, sourceName, compact }) =>
		toMarketIndex(
			name,
			tseRecords.find(
				(record) =>
					String(firstValue(record, INDEX_NAME_FIELDS)) === sourceName,
			),
			compact,
		),
	);
	const latestOtcRecord = otcRecords.reduce<UnknownRecord | undefined>(
		(latest, record) =>
			getDateKey(parseDate(firstValue(record, DATE_FIELDS))) >
			getDateKey(parseDate(firstValue(latest, DATE_FIELDS)))
				? record
				: latest,
		undefined,
	);

	return [
		tseIndexes[0],
		toMarketIndex("櫃買指數", latestOtcRecord, false),
		...tseIndexes.slice(1),
	];
}

export async function downloadIntradayMarketIndexes(
	credentials: ServerCredentials,
	fetcher: Fetcher = fetch,
): Promise<MarketIndex[]> {
	const quotes = await downloadIntradayQuotes(
		INTRADAY_MARKET_INDEXES.map(({ code }) => code),
		credentials,
		fetcher,
	);

	return INTRADAY_MARKET_INDEXES.map(({ name, compact }, index) => {
		const quote = toIntradayQuoteDisplay(quotes[index]);
		return {
			name,
			compact,
			date: "--",
			value: quote.price,
			change: quote.change,
			percent: quote.percent,
			direction: quote.direction,
		};
	});
}
