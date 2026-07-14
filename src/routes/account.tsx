import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import {
	type AccountAllocation,
	type AccountSummary,
	downloadAccountSummary,
} from "#/lib/account-summary";
import { getStoredSecurities } from "#/lib/security-search";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
	const [serverCredentials] = useState(() =>
		getAuthenticatedServerCredentials(),
	);
	const [summary, setSummary] = useState<AccountSummary | null>(null);
	const [isLoading, setIsLoading] = useState(serverCredentials !== null);
	const [error, setError] = useState(false);
	const [securities, setSecurities] = useState(() => getStoredSecurities());
	const securityNames = useMemo(
		() => new Map(securities.map(({ ticker, name }) => [ticker, name])),
		[securities],
	);

	useEffect(() => {
		if (!serverCredentials) return;
		let cancelled = false;
		void downloadAccountSummary(serverCredentials)
			.then((downloadedSummary) => {
				if (!cancelled) setSummary(downloadedSummary);
			})
			.catch(() => {
				if (!cancelled) setError(true);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [serverCredentials]);

	useEffect(() => {
		const refreshSecurities = () => setSecurities(getStoredSecurities());
		window.addEventListener("storage", refreshSecurities);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshSecurities);

		return () => {
			window.removeEventListener("storage", refreshSecurities);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshSecurities);
		};
	}, []);

	const profitLoss = summary?.unrealizedProfitLoss ?? 0;
	const profitLossDirection =
		profitLoss > 0 ? "gain" : profitLoss < 0 ? "loss" : "neutral";

	return (
		<>
			<main className="app-page account-page">
				<PageHeader title="帳戶" />

				{!serverCredentials && (
					<div className="empty-state" role="alert">
						<strong>請先登入帳戶</strong>
						<span>登入後即可查看帳戶資產與未實現損益。</span>
					</div>
				)}

				{error && (
					<div className="market-data-state" role="alert">
						帳戶資料暫時無法取得，請稍後再試。
					</div>
				)}

				{serverCredentials && (
					<>
						<section
							className="balance-card"
							aria-label="資產摘要"
							aria-busy={isLoading}
						>
							<div>
								<small>總資產</small>
								<div className="balance-amount">
									{summary ? formatCurrency(summary.totalAssets) : "NT$ --"}
								</div>
							</div>
							<div className="balance-metrics">
								<div className="balance-metric">
									<small>未實現損益</small>
									<strong className={profitLossDirection}>
										{summary ? formatSignedCurrency(profitLoss) : "--"}
									</strong>
									<small className={profitLossDirection}>
										{summary
											? formatProfitLossRate(summary.unrealizedProfitLossRate)
											: "--"}
									</small>
								</div>
							</div>
						</section>

						<section className="account-section" aria-label="資產配置">
							<div className="section-heading">
								<h2>配置</h2>
								<Link to="/holdings">檢視明細</Link>
							</div>
							{summary && summary.allocations.length > 0 ? (
								<AllocationChart
									allocations={summary.allocations}
									securityNames={securityNames}
								/>
							) : (
								<div className="allocation-card allocation-card--empty">
									{isLoading
										? "正在載入資產配置…"
										: "目前沒有可顯示的資產配置。"}
								</div>
							)}
						</section>
					</>
				)}
			</main>
			<MainNavigation active="account" />
		</>
	);
}

const ALLOCATION_COLORS = [
	"var(--gain)",
	"var(--accent)",
	"oklch(72% 0.08 80)",
	"oklch(88% 0.018 70)",
];

function formatCurrency(value: number) {
	return `NT$ ${Math.round(value).toLocaleString("en-US")}`;
}

function formatSignedCurrency(value: number) {
	const roundedValue = Math.round(value);
	return `${roundedValue > 0 ? "+" : ""}${roundedValue.toLocaleString("en-US")}`;
}

function formatProfitLossRate(value: number | null) {
	if (value === null) return "--";
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPercentage(value: number) {
	return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function createAllocationGradient(allocations: AccountAllocation[]) {
	let currentPercentage = 0;
	const stops = allocations.map((allocation, index) => {
		const start = currentPercentage;
		currentPercentage += allocation.percentage;
		return `${ALLOCATION_COLORS[index]} ${start}% ${currentPercentage}%`;
	});
	if (currentPercentage < 100) {
		stops.push(`oklch(88% 0.018 70) ${currentPercentage}% 100%`);
	}
	return `conic-gradient(${stops.join(", ")})`;
}

function AllocationChart({
	allocations,
	securityNames,
}: {
	allocations: AccountAllocation[];
	securityNames: Map<string, string>;
}) {
	const chartLabel = allocations
		.map(
			(allocation) =>
				`${allocation.code} ${formatPercentage(allocation.percentage)}`,
		)
		.join("、");

	return (
		<Link
			className="allocation-card"
			to="/holdings"
			aria-label="檢視資產配置明細"
		>
			<span
				className="allocation-donut"
				style={{ background: createAllocationGradient(allocations) }}
				role="img"
				aria-label={`資產配置：${chartLabel}`}
			/>
			<span className="allocation-legend">
				{allocations.map((allocation, index) => (
					<span className="allocation-row" key={allocation.code}>
						<i
							className="dot"
							style={{ background: ALLOCATION_COLORS[index] }}
						/>
						<span>
							<strong>
								{securityNames.get(allocation.code) ?? allocation.name}
							</strong>
							<small>{allocation.code}</small>
						</span>
						<b>{formatPercentage(allocation.percentage)}</b>
					</span>
				))}
			</span>
		</Link>
	);
}
