import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import {
	downloadIntradayMarketIndexes,
	downloadMarketIndexes,
	type MarketIndex,
} from "#/lib/market-index";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";

export const Route = createFileRoute("/market")({ component: MarketPage });

const EMPTY_INDEXES: MarketIndex[] = [
	{ name: "加權指數", compact: false },
	{ name: "櫃買指數", compact: false },
	{ name: "電子指數", compact: true },
	{ name: "金融指數", compact: true },
	{ name: "半導體指數", compact: true },
].map(({ name, compact }) => ({
	name,
	compact,
	date: "--",
	value: "--",
	change: "--",
	percent: "--",
	direction: "neutral",
}));

function IndexCard({ index }: { index: MarketIndex }) {
	return (
		<article className={`index-card ${index.compact ? "compact" : ""}`}>
			<div className="index-card__header">
				<span>{index.name}</span>
			</div>
			<strong className={index.direction}>{index.value}</strong>
			<span className={`index-delta ${index.direction}`}>
				<strong>{index.change}</strong>
				<small>({index.percent})</small>
			</span>
		</article>
	);
}

function MarketPage() {
	const [indexes, setIndexes] = useState(EMPTY_INDEXES);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(false);
	const [serverCredentials] = useState(() =>
		getAuthenticatedServerCredentials(),
	);
	const isAuthenticated = serverCredentials !== null;

	useEffect(() => {
		let cancelled = false;
		const indexesPromise = serverCredentials
			? downloadIntradayMarketIndexes(serverCredentials)
			: downloadMarketIndexes();
		void indexesPromise
			.then((downloadedIndexes) => {
				if (!cancelled) setIndexes(downloadedIndexes);
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

	const earliestDataDate = indexes.reduce<string | null>((earliest, index) => {
		if (index.date === "--") return earliest;
		return earliest === null || index.date < earliest ? index.date : earliest;
	}, null);

	return (
		<>
			<main className="app-page market-page">
				<PageHeader
					title="市場"
					action={
						<button className="icon-button" type="button" aria-label="篩選">
							<SlidersHorizontal />
						</button>
					}
				/>
				{!isAuthenticated && (
					<div className="hint">資料更新於 {earliestDataDate ?? "--"}</div>
				)}
				{error && (
					<div className="market-data-state" role="alert">
						市場指數暫時無法取得，請稍後再試。
					</div>
				)}
				<section
					className="index-board"
					aria-label="市場指數"
					aria-busy={isLoading}
				>
					<div className="index-row primary">
						{indexes.slice(0, 2).map((index) => (
							<IndexCard key={index.name} index={index} />
						))}
					</div>
					<div className="index-row secondary">
						{indexes.slice(2).map((index) => (
							<IndexCard key={index.name} index={index} />
						))}
					</div>
				</section>
			</main>
			<MainNavigation active="market" />
		</>
	);
}
