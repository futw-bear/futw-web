import { normalizeServerAddress, type ServerCredentials } from "./server-auth";

export const ACCOUNT_UNREALIZED_GAINS_PATH =
	"/proxy/trading/account-management/unrealized-gains-and-loses";

type Fetcher = typeof fetch;
type UnknownRecord = Record<string, unknown>;

type UnrealizedPosition = {
	code: string;
	name: string;
	costPrice: number;
	tradableQty: number;
	unrealizedProfit: number;
	unrealizedLoss: number;
};

export type AccountAllocation = {
	code: string;
	name: string;
	value: number;
	percentage: number;
};

export type AccountSummary = {
	totalCost: number;
	totalAssets: number;
	unrealizedProfitLoss: number;
	unrealizedProfitLossRate: number | null;
	allocations: AccountAllocation[];
};

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value !== "string") return 0;
	const parsed = Number(value.replaceAll(",", "").trim());
	return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown) {
	if (typeof value !== "string" && typeof value !== "number") return null;
	return String(value).trim() || null;
}

function firstText(record: UnknownRecord, fields: string[]) {
	for (const field of fields) {
		const text = toText(record[field]);
		if (text) return text;
	}
	return null;
}

function extractPositions(payload: unknown): UnknownRecord[] {
	if (Array.isArray(payload)) return payload.filter(isRecord);
	if (!isRecord(payload)) return [];
	return extractPositions(payload.data);
}

function normalizePosition(record: UnknownRecord): UnrealizedPosition {
	const code =
		firstText(record, [
			"stockNo",
			"symbol",
			"ticker",
			"securityCode",
			"code",
		]) ?? "未命名";
	const name = firstText(record, ["stockName", "securityName", "name"]) ?? code;

	return {
		code,
		name,
		costPrice: toFiniteNumber(record.costPrice),
		tradableQty: toFiniteNumber(record.tradableQty),
		unrealizedProfit: toFiniteNumber(record.unrealizedProfit),
		unrealizedLoss: toFiniteNumber(record.unrealizedLoss),
	};
}

export function summarizeAccountPositions(payload: unknown): AccountSummary {
	const positions = extractPositions(payload).map(normalizePosition);
	const totalCost = positions.reduce(
		(sum, position) => sum + position.costPrice * position.tradableQty,
		0,
	);
	const unrealizedProfitLoss = positions.reduce(
		(sum, position) =>
			sum + position.unrealizedProfit - position.unrealizedLoss,
		0,
	);
	const totalAssets = totalCost + unrealizedProfitLoss;
	const amountsByCode = new Map<
		string,
		Omit<AccountAllocation, "percentage">
	>();

	for (const position of positions) {
		const value =
			position.costPrice * position.tradableQty +
			position.unrealizedProfit -
			position.unrealizedLoss;
		if (value <= 0) continue;
		const existing = amountsByCode.get(position.code);
		if (existing) {
			existing.value += value;
		} else {
			amountsByCode.set(position.code, {
				code: position.code,
				name: position.name,
				value,
			});
		}
	}

	const sortedAllocations = [...amountsByCode.values()].sort(
		(left, right) => right.value - left.value,
	);
	const topAllocations = sortedAllocations.slice(0, 3);
	const otherValue = sortedAllocations
		.slice(3)
		.reduce((sum, allocation) => sum + allocation.value, 0);
	if (otherValue > 0) {
		topAllocations.push({
			code: "其他",
			name: "其餘持股",
			value: otherValue,
		});
	}

	return {
		totalCost,
		totalAssets,
		unrealizedProfitLoss,
		unrealizedProfitLossRate:
			totalCost === 0 ? null : (unrealizedProfitLoss / totalCost) * 100,
		allocations: topAllocations.map((allocation) => ({
			...allocation,
			percentage: totalAssets > 0 ? (allocation.value / totalAssets) * 100 : 0,
		})),
	};
}

export async function downloadAccountSummary(
	credentials: ServerCredentials,
	fetcher: Fetcher = fetch,
) {
	const serverAddress = normalizeServerAddress(credentials.serverAddress);
	const response = await fetcher(
		`${serverAddress}${ACCOUNT_UNREALIZED_GAINS_PATH}`,
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
		throw new Error(`Unable to download account summary: ${response.status}`);
	}

	return summarizeAccountPositions(await response.json());
}
