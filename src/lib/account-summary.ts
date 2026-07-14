import { normalizeServerAddress, type ServerCredentials } from "./server-auth";

export const ACCOUNT_UNREALIZED_GAINS_PATH =
	"/proxy/trading/account-management/unrealized-gains-and-loses";

export const ACCOUNT_ALLOCATION_COLORS = [
	"var(--gain)",
	"var(--accent)",
	"oklch(72% 0.08 80)",
	"#768E8B",
	"#947D9D",
] as const;
export const ACCOUNT_OTHER_ALLOCATION_COLOR = "oklch(88% 0.018 70)";

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

export type AccountHolding = {
	code: string;
	name: string;
	shares: number;
	totalCost: number;
	unrealizedProfitLoss: number;
	unrealizedProfitLossRate: number | null;
	value: number;
};

export function getAccountAllocationColor(
	allocation: Pick<AccountAllocation, "code">,
	index: number,
) {
	return allocation.code === "其他"
		? ACCOUNT_OTHER_ALLOCATION_COLOR
		: (ACCOUNT_ALLOCATION_COLORS[index] ?? ACCOUNT_OTHER_ALLOCATION_COLOR);
}

export type AccountSummary = {
	totalCost: number;
	totalAssets: number;
	unrealizedProfitLoss: number;
	unrealizedProfitLossRate: number | null;
	allocations: AccountAllocation[];
	detailAllocations: AccountAllocation[];
	holdings: AccountHolding[];
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
	const holdingsByCode = new Map<string, AccountHolding>();

	for (const position of positions) {
		const positionCost = position.costPrice * position.tradableQty;
		const positionProfitLoss =
			position.unrealizedProfit - position.unrealizedLoss;
		const value = positionCost + positionProfitLoss;
		const existing = holdingsByCode.get(position.code);
		if (existing) {
			existing.value += value;
			existing.shares += position.tradableQty;
			existing.totalCost += positionCost;
			existing.unrealizedProfitLoss += positionProfitLoss;
		} else {
			holdingsByCode.set(position.code, {
				code: position.code,
				name: position.name,
				shares: position.tradableQty,
				totalCost: positionCost,
				unrealizedProfitLoss: positionProfitLoss,
				unrealizedProfitLossRate: null,
				value,
			});
		}
	}

	const holdings = [...holdingsByCode.values()]
		.map((holding) => ({
			...holding,
			unrealizedProfitLossRate:
				holding.totalCost === 0
					? null
					: (holding.unrealizedProfitLoss / holding.totalCost) * 100,
		}))
		.filter((holding) => holding.value > 0 || holding.shares > 0)
		.sort((left, right) => right.value - left.value);
	const positiveHoldings = holdings.filter((holding) => holding.value > 0);
	const createAllocations = (limit: number) => {
		const topAllocations = positiveHoldings.slice(0, limit).map((holding) => ({
			code: holding.code,
			name: holding.name,
			value: holding.value,
		}));
		const otherValue = positiveHoldings
			.slice(limit)
			.reduce((sum, holding) => sum + holding.value, 0);
		if (otherValue > 0) {
			topAllocations.push({
				code: "其他",
				name: "其餘持股",
				value: otherValue,
			});
		}

		return topAllocations.map((allocation) => ({
			...allocation,
			percentage: totalAssets > 0 ? (allocation.value / totalAssets) * 100 : 0,
		}));
	};

	return {
		totalCost,
		totalAssets,
		unrealizedProfitLoss,
		unrealizedProfitLossRate:
			totalCost === 0 ? null : (unrealizedProfitLoss / totalCost) * 100,
		allocations: createAllocations(3),
		detailAllocations: createAllocations(5),
		holdings,
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
