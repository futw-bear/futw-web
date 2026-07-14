import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import {
	downloadIntradayQuotes,
	toIntradayQuoteDisplay,
} from "#/lib/intraday-quotes";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";
import { getWatchlistStocks } from "#/lib/watchlist";

export const Route = createFileRoute("/")({ component: Home });

function resetStockQuote(stock: ReturnType<typeof getWatchlistStocks>[number]) {
	return {
		...stock,
		price: "--",
		change: "--",
		percent: "--",
		direction: "neutral" as const,
	};
}

function Home() {
	const [serverCredentials] = useState(() =>
		getAuthenticatedServerCredentials(),
	);
	const isAuthenticated = serverCredentials !== null;
	const [stocks, setStocks] = useState(() => {
		const storedStocks = getWatchlistStocks();
		return isAuthenticated ? storedStocks.map(resetStockQuote) : storedStocks;
	});
	const [liveQuoteError, setLiveQuoteError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const refreshStocks = () => {
			const storedStocks = getWatchlistStocks();
			setStocks(
				serverCredentials ? storedStocks.map(resetStockQuote) : storedStocks,
			);
			setLiveQuoteError(false);
			if (!serverCredentials) return;

			void downloadIntradayQuotes(
				storedStocks.map(({ ticker }) => ticker),
				serverCredentials,
			)
				.then((quotes) => {
					if (cancelled) return;
					setStocks(
						storedStocks.map((stock, index) => ({
							...stock,
							...toIntradayQuoteDisplay(quotes[index]),
						})),
					);
				})
				.catch(() => {
					if (!cancelled) setLiveQuoteError(true);
				});
		};
		refreshStocks();
		window.addEventListener("storage", refreshStocks);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshStocks);

		return () => {
			cancelled = true;
			window.removeEventListener("storage", refreshStocks);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshStocks);
		};
	}, [serverCredentials]);

	const visibleStocks = stocks;
	const earliestDataDate = visibleStocks.reduce<string | null>(
		(earliest, stock) => {
			if (stock.date === "--") return earliest;
			return earliest === null || stock.date < earliest ? stock.date : earliest;
		},
		null,
	);

	return (
		<>
			<main className="app-page watchlist-page">
				<PageHeader
					title="自選"
					action={
						<Link className="icon-button" to="/search" aria-label="搜尋">
							<Search />
						</Link>
					}
				/>

				{!isAuthenticated && (
					<div className="hint">資料更新於 {earliestDataDate ?? "--"}</div>
				)}
				{liveQuoteError && (
					<div className="market-data-state" role="alert">
						即時行情暫時無法取得，請稍後再試。
					</div>
				)}

				<div className="watchlist-toolbar" aria-hidden="true">
					<span />
					<span>
						價格 <ArrowUpDown />
					</span>
					<span>
						漲跌 <ArrowUpDown />
					</span>
				</div>

				<section className="watchlist" aria-label="自選清單">
					{visibleStocks.map((stock) => (
						<div className="watchlist-row" key={stock.ticker}>
							<div className="security-name">
								{isAuthenticated ? (
									<Link to="/stocks/$ticker" params={{ ticker: stock.ticker }}>
										<strong>{stock.name}</strong>
										<small>{stock.ticker}</small>
									</Link>
								) : (
									<span
										className="security-name__disabled"
										aria-disabled="true"
									>
										<strong>{stock.name}</strong>
										<small>{stock.ticker}</small>
									</span>
								)}
							</div>
							{isAuthenticated ? (
								<Link
									className={`stock-price ${stock.direction}`}
									to="/stocks/$ticker"
									params={{ ticker: stock.ticker }}
								>
									{stock.price}
								</Link>
							) : (
								<span
									className={`stock-price ${stock.direction}`}
									aria-disabled="true"
								>
									{stock.price}
								</span>
							)}
							{isAuthenticated ? (
								<Link
									className={`change-pill ${stock.direction}`}
									to="/stocks/$ticker"
									params={{ ticker: stock.ticker }}
								>
									<strong>{stock.change}</strong>
									<small>{stock.percent}</small>
								</Link>
							) : (
								<span
									className={`change-pill ${stock.direction}`}
									aria-disabled="true"
								>
									<strong>{stock.change}</strong>
									<small>{stock.percent}</small>
								</span>
							)}
						</div>
					))}
				</section>

				{visibleStocks.length === 0 && (
					<div className="empty-state">此分類目前沒有自選項目。</div>
				)}

				<div className="watchlist-actions">
					<Link to="/search">
						<Plus />
						新增自選
					</Link>
					<button type="button">
						<Pencil />
						編輯自選
					</button>
				</div>
			</main>
			<MainNavigation active="watchlist" />
		</>
	);
}
