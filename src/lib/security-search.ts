export const SECURITIES_STORAGE_KEY = "securities";

type StorageLike = Pick<Storage, "getItem">;
type UnknownRecord = Record<string, unknown>;

export type SearchableSecurity = {
	ticker: string;
	name: string;
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
	"SecuritiesCompanyName",
];
const COLLECTION_FIELDS = ["data", "items", "result", "results", "securities"];

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

function normalizeText(value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const text = String(value).trim();
	return text || null;
}

function extractSecurityRecords(value: unknown): UnknownRecord[] {
	if (Array.isArray(value)) return value.flatMap(extractSecurityRecords);
	if (!isRecord(value)) return [];

	if (normalizeText(firstValue(value, TICKER_FIELDS))) return [value];

	for (const field of COLLECTION_FIELDS) {
		if (field in value) return extractSecurityRecords(value[field]);
	}

	return Object.entries(value).flatMap(([ticker, record]) =>
		isRecord(record) && /^\d{4,6}[A-Z]?$/.test(ticker)
			? [{ ticker, ...record }]
			: [],
	);
}

export function getStoredSecurities(
	storage: StorageLike = window.localStorage,
): SearchableSecurity[] {
	const storedValue = storage.getItem(SECURITIES_STORAGE_KEY);
	if (!storedValue) return [];

	try {
		const indexed = new Map<string, SearchableSecurity>();
		for (const record of extractSecurityRecords(JSON.parse(storedValue))) {
			const ticker = normalizeText(firstValue(record, TICKER_FIELDS));
			if (!ticker || indexed.has(ticker)) continue;
			const name = normalizeText(firstValue(record, NAME_FIELDS)) ?? ticker;
			indexed.set(ticker, { ticker, name });
		}
		return [...indexed.values()];
	} catch {
		return [];
	}
}

export function searchSecurities(
	securities: SearchableSecurity[],
	query: string,
) {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (!normalizedQuery) return [];

	return securities.filter(({ ticker, name }) =>
		`${ticker}${name}`.toLocaleLowerCase().includes(normalizedQuery),
	);
}
