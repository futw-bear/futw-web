import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MainNavigation } from "#/components/app-shell";
import {
	type AccountAllocation,
	type AccountSummary,
	downloadAccountSummary,
	getAccountAllocationColor,
} from "#/lib/account-summary";
import { getStoredSecurities } from "#/lib/security-search";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";

export const Route = createFileRoute("/holdings")({ component: HoldingsPage });

function HoldingsPage() {
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

	const getSecurityName = (code: string, fallback: string) =>
		securityNames.get(code) ?? fallback;

	return (
		<>
			<main className="app-page holdings-page">
				<header className="detail-header">
					<Link className="icon-button" to="/account" aria-label="返回帳戶">
						<ChevronLeft />
					</Link>
					<h1>配置明細</h1>
					<span className="header-spacer" aria-hidden="true" />
				</header>

				{!serverCredentials && (
					<div className="empty-state" role="alert">
						<strong>請先登入帳戶</strong>
						<span>登入後即可查看資產配置與所有持股。</span>
					</div>
				)}

				{error && (
					<div className="market-data-state" role="alert">
						持股資料暫時無法取得，請稍後再試。
					</div>
				)}

				{serverCredentials && (
					<>
						<section
							className="asset-card"
							aria-label="資產分佈摘要"
							aria-busy={isLoading}
						>
							<div className="asset-total">
								<span>總資產</span>
								<strong>
									<small>TWD</small>
									{summary ? formatNumber(summary.totalAssets) : "--"}
								</strong>
							</div>
							{summary && summary.detailAllocations.length > 0 ? (
								<DistributionChart
									allocations={summary.detailAllocations}
									securityNames={securityNames}
								/>
							) : (
								<div className="distribution-empty">
									{isLoading
										? "正在載入資產配置…"
										: error
											? "無法載入資產配置。"
											: "目前沒有可顯示的資產配置。"}
								</div>
							)}
						</section>

						<section className="holdings-card" aria-label="所有持股">
							<div className="holdings-title">
								<h2>所有持股</h2>
							</div>
							<section
								className="holdings-table-scroll"
								aria-label="持股資料，可水平捲動"
							>
								<div className="holdings-table">
									<div className="holdings-columns" aria-hidden="true">
										<span>證券名稱</span>
										<span>持有股數</span>
										<span>損益</span>
										<span>市值</span>
									</div>
									{summary?.holdings.map((holding) => {
										const direction =
											holding.unrealizedProfitLoss > 0
												? "gain"
												: holding.unrealizedProfitLoss < 0
													? "loss"
													: "neutral";
										return (
											<Link
												className="holding-row"
												to="/stocks/$ticker"
												params={{ ticker: holding.code }}
												key={holding.code}
											>
												<span className="holding-security">
													<strong>
														{getSecurityName(holding.code, holding.name)}
													</strong>
													<small>{holding.code}</small>
												</span>
												<strong>{formatNumber(holding.shares)}</strong>
												<strong className={`holding-profit-loss ${direction}`}>
													{formatProfitLoss(
														holding.unrealizedProfitLoss,
														holding.unrealizedProfitLossRate,
													)}
												</strong>
												<strong>
													{formatNumber(holding.value)}
													<ChevronRight />
												</strong>
											</Link>
										);
									})}
									{(!summary || summary.holdings.length === 0) && (
										<div className="holdings-empty">
											{isLoading
												? "正在載入持股…"
												: error
													? "無法載入持股。"
													: "目前沒有持股。"}
										</div>
									)}
								</div>
							</section>
						</section>
					</>
				)}
			</main>
			<MainNavigation active="account" />
		</>
	);
}

function formatNumber(value: number) {
	return Math.round(value).toLocaleString("en-US");
}

function formatProfitLoss(value: number, rate: number | null) {
	const signedValue = `${value > 0 ? "+" : ""}${formatNumber(value)}`;
	const signedRate =
		rate === null ? "--" : `${rate > 0 ? "+" : ""}${rate.toFixed(2)}%`;
	return `${signedValue}（${signedRate}）`;
}

function formatPercentage(value: number) {
	return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function createAllocationGradient(allocations: AccountAllocation[]) {
	let currentPercentage = 0;
	const stops = allocations.map((allocation, index) => {
		const start = currentPercentage;
		currentPercentage += allocation.percentage;
		return `${getAccountAllocationColor(allocation, index)} ${start}% ${currentPercentage}%`;
	});
	if (currentPercentage < 100) {
		stops.push(`var(--border) ${currentPercentage}% 100%`);
	}
	return `conic-gradient(${stops.join(", ")})`;
}

function DistributionChart({
	allocations,
	securityNames,
}: {
	allocations: AccountAllocation[];
	securityNames: Map<string, string>;
}) {
	const chartLabel = allocations
		.map(
			(allocation) =>
				`${securityNames.get(allocation.code) ?? allocation.name} ${formatPercentage(allocation.percentage)}`,
		)
		.join("、");

	return (
		<div className="distribution-chart">
			<span
				className="distribution-pie"
				style={{ background: createAllocationGradient(allocations) }}
				role="img"
				aria-label={`資產配置：${chartLabel}`}
			/>
			<span className="distribution-legend">
				{allocations.map((allocation, index) => (
					<span key={allocation.code}>
						<i
							style={{
								background: getAccountAllocationColor(allocation, index),
							}}
						/>
						{securityNames.get(allocation.code) ?? allocation.name}
						<strong>{formatPercentage(allocation.percentage)}</strong>
					</span>
				))}
			</span>
		</div>
	);
}
