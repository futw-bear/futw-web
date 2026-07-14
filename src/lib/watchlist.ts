export const WATCHLIST_STORAGE_KEY = "watchlist";
export const DEFAULT_WATCHLIST = [
	"2330",
	"2317",
	"0050",
	"2454",
	"2412",
	"2884",
] as const;

const SECURITIES_STORAGE_KEY = "securities";
const TSE_PRICES_STORAGE_KEY = "prices:TSE";
const OTC_PRICES_STORAGE_KEY = "prices:OTC";
const LEGACY_TSE_PRICES_STORAGE_KEY = "price:TSE";
const LEGACY_TES_PRICES_STORAGE_KEY = "price:TES";
const LEGACY_OTC_PRICES_STORAGE_KEY = "price:OTC";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type UnknownRecord = Record<string, unknown>;

export type WatchlistStock = {
	ticker: string;
	name: string;
	date: string;
	price: string;
	change: string;
	percent: string;
	direction: "gain" | "loss" | "neutral";
	kind: "證券" | "ETF";
};

const TICKER_FIELDS = [
	"ticker",
	"code",
	"symbol",
	"security_code",
	"Code",
	"SecuritiesCompanyCode",
];
const NAME_FIELDS = [
	"name",
	"short_name",
	"shortName",
	"security_name",
	"Name",
	"CompanyName",
];
const DATE_FIELDS = [
	"date",
	"tradeDate",
	"trade_date",
	"dataDate",
	"data_date",
	"Date",
	"__dataDate",
];
const TYPE_FIELDS = [
	"type",
	"kind",
	"category",
	"securityType",
	"security_type",
	"SecurityType",
];
const COLLECTION_FIELDS = [
	"data",
	"items",
	"result",
	"results",
	"securities",
	"prices",
];

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

function normalizeTicker(value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const ticker = String(value).trim();
	return ticker.length > 0 ? ticker : null;
}

function hasTicker(record: UnknownRecord) {
	return normalizeTicker(firstValue(record, TICKER_FIELDS)) !== null;
}

function extractRecords(value: unknown): UnknownRecord[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => extractRecords(item));
	}
	if (!isRecord(value)) return [];
	if (hasTicker(value)) return [value];

	for (const field of COLLECTION_FIELDS) {
		if (field in value) {
			const records = extractRecords(value[field]);
			if (records.length > 0) {
				const dataDate = firstValue(value, DATE_FIELDS);
				return dataDate === undefined
					? records
					: records.map((record) =>
							firstValue(record, DATE_FIELDS) === undefined
								? { ...record, __dataDate: dataDate }
								: record,
						);
			}
		}
	}

	return Object.entries(value).flatMap(([key, item]) => {
		if (isRecord(item) && /^\d{4,6}[A-Z]?$/.test(key)) {
			return [{ ticker: key, ...item }];
		}
		if (
			(typeof item === "string" || typeof item === "number") &&
			/^\d{4,6}[A-Z]?$/.test(key)
		) {
			return [{ ticker: key, price: item }];
		}
		return extractRecords(item);
	});
}

function parseStoredValue(storage: StorageLike, key: string) {
	const value = storage.getItem(key);
	if (value === null) return null;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

function indexRecords(value: unknown) {
	const records = new Map<string, UnknownRecord>();
	for (const record of extractRecords(value)) {
		const ticker = normalizeTicker(firstValue(record, TICKER_FIELDS));
		if (ticker) records.set(ticker, record);
	}
	return records;
}

function parseNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.replaceAll(",", "").replace("%", "").trim();
	if (!normalized || normalized === "--") return null;
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
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
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(2)}${suffix}`;
}

type CalendarDate = {
	year: number;
	month: number;
	day: number;
};

function isValidCalendarDate({ year, month, day }: CalendarDate) {
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function parseDataDate(value: unknown, isMinguoDate: boolean) {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const date = String(value).trim().split("T")[0] ?? "";
	const minguoMatch = date.match(/^(\d{3})[/-]?(\d{2})[/-]?(\d{2})$/);
	const gregorianMatch = date.match(/^(\d{4})[/-]?(\d{2})[/-]?(\d{2})$/);
	const match = isMinguoDate ? minguoMatch : gregorianMatch;
	if (!match) return null;

	const parsed = {
		year: Number(match[1]) + (isMinguoDate ? 1911 : 0),
		month: Number(match[2]),
		day: Number(match[3]),
	};
	return isValidCalendarDate(parsed) ? parsed : null;
}

function formatDataDate(date: CalendarDate | null) {
	if (!date) return "--";
	return `${date.year}/${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")}`;
}

function getKind(ticker: string, security: UnknownRecord | undefined) {
	const type = String(firstValue(security, TYPE_FIELDS) ?? "").toUpperCase();
	return type.includes("ETF") || ticker.startsWith("00") ? "ETF" : "證券";
}

export function getStoredWatchlist(storage: StorageLike = window.localStorage) {
	const storedValue = storage.getItem(WATCHLIST_STORAGE_KEY);
	if (storedValue !== null) {
		try {
			const parsed = JSON.parse(storedValue) as unknown;
			if (Array.isArray(parsed)) {
				return Array.from(
					new Set(
						parsed.map(normalizeTicker).filter((ticker) => ticker !== null),
					),
				);
			}
		} catch {
			// Invalid data is replaced with the default watchlist below.
		}
	}

	const defaults = [...DEFAULT_WATCHLIST];
	storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(defaults));
	return defaults;
}

export function getWatchlistStocks(
	storage: StorageLike = window.localStorage,
): WatchlistStock[] {
	const tickers = getStoredWatchlist(storage);
	const securities = indexRecords(
		parseStoredValue(storage, SECURITIES_STORAGE_KEY),
	);
	const tsePrices = indexRecords(
		parseStoredValue(storage, TSE_PRICES_STORAGE_KEY) ??
			parseStoredValue(storage, LEGACY_TSE_PRICES_STORAGE_KEY) ??
			parseStoredValue(storage, LEGACY_TES_PRICES_STORAGE_KEY),
	);
	const otcPrices = indexRecords(
		parseStoredValue(storage, OTC_PRICES_STORAGE_KEY) ??
			parseStoredValue(storage, LEGACY_OTC_PRICES_STORAGE_KEY),
	);
	return tickers.map((ticker) => {
		const security = securities.get(ticker);
		const tsePriceRecord = tsePrices.get(ticker);
		const otcPriceRecord = otcPrices.get(ticker);
		const priceRecord = tsePriceRecord ?? otcPriceRecord;
		const isMinguoDate =
			priceRecord !== undefined &&
			(tsePriceRecord !== undefined || otcPriceRecord !== undefined) &&
			("Date" in priceRecord || "__dataDate" in priceRecord);
		const dataDate = parseDataDate(
			firstValue(priceRecord, DATE_FIELDS),
			isMinguoDate,
		);
		const price = parseNumber(
			tsePriceRecord?.ClosingPrice ?? otcPriceRecord?.Close,
		);
		const open = parseNumber(
			tsePriceRecord?.OpeningPrice ?? otcPriceRecord?.Open,
		);
		const change = price !== null && open !== null ? price - open : null;
		const percent =
			change !== null && open !== null && open !== 0
				? (change / open) * 100
				: null;
		const name = firstValue(security, NAME_FIELDS);

		return {
			ticker,
			name: typeof name === "string" && name.trim() ? name.trim() : ticker,
			date: formatDataDate(dataDate),
			price: formatPrice(price),
			change: formatSigned(change),
			percent: formatSigned(percent, "%"),
			direction:
				change === null || change === 0
					? "neutral"
					: change > 0
						? "gain"
						: "loss",
			kind: getKind(ticker, security),
		};
	});
}
