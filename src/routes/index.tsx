import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";
import { getWatchlistStocks } from "#/lib/watchlist";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const [stocks, setStocks] = useState(() => getWatchlistStocks());

	useEffect(() => {
		const refreshStocks = () => setStocks(getWatchlistStocks());
		window.addEventListener("storage", refreshStocks);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshStocks);

		return () => {
			window.removeEventListener("storage", refreshStocks);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshStocks);
		};
	}, []);

	const visibleStocks = stocks;

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
								<Link to="/stocks/$ticker" params={{ ticker: stock.ticker }}>
									<strong>{stock.name}</strong>
									<small>{stock.ticker}</small>
								</Link>
							</div>
							<Link
								className={`stock-price ${stock.direction}`}
								to="/stocks/$ticker"
								params={{ ticker: stock.ticker }}
							>
								{stock.price}
							</Link>
							<Link
								className={`change-pill ${stock.direction}`}
								to="/stocks/$ticker"
								params={{ ticker: stock.ticker }}
							>
								<strong>{stock.change}</strong>
								<small>{stock.percent}</small>
							</Link>
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
