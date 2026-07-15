import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MainNavigation } from "#/components/app-shell";
import { getStoredSecurities, searchSecurities } from "#/lib/security-search";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";
import { getStoredWatchlist, toggleWatchlistTicker } from "#/lib/watchlist";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
	const [serverCredentials] = useState(() =>
		getAuthenticatedServerCredentials(),
	);
	const isAuthenticated = serverCredentials !== null;
	const [query, setQuery] = useState("");
	const [securities, setSecurities] = useState(() => getStoredSecurities());
	const [watchlist, setWatchlist] = useState(() => getStoredWatchlist());
	const normalizedQuery = query.trim();
	const results = useMemo(
		() => searchSecurities(securities, normalizedQuery),
		[normalizedQuery, securities],
	);

	useEffect(() => {
		const refreshStoredData = () => {
			setSecurities(getStoredSecurities());
			setWatchlist(getStoredWatchlist());
		};
		window.addEventListener("storage", refreshStoredData);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshStoredData);

		return () => {
			window.removeEventListener("storage", refreshStoredData);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshStoredData);
		};
	}, []);

	return (
		<>
			<main className="app-page search-page">
				<div className="search-row">
					<label className="search-field">
						<Search aria-hidden="true" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="股票代號或名稱"
							aria-label="搜尋股票或 ETF"
						/>
					</label>
					<Link className="cancel-link" to="/">
						取消
					</Link>
				</div>

				{normalizedQuery ? (
					results.length > 0 ? (
						<section
							className="search-results"
							aria-label="搜尋結果"
							aria-live="polite"
						>
							{results.map((security) => {
								const favorite = watchlist.includes(security.ticker);
								return (
									<div className="search-result" key={security.ticker}>
										<button
											className={`search-result__favorite ${favorite ? "selected" : ""}`}
											type="button"
											aria-pressed={favorite}
											aria-label={
												favorite
													? `從自選移除${security.name}`
													: `將${security.name}加入自選`
											}
											onClick={() =>
												setWatchlist(toggleWatchlistTicker(security.ticker))
											}
										>
											<Heart fill={favorite ? "currentColor" : "none"} />
										</button>
										{isAuthenticated ? (
											<Link
												className="search-result__link"
												to="/stocks/$ticker"
												params={{ ticker: security.ticker }}
											>
												<span className="search-result__security">
													<strong>{security.name}</strong>
													<small>{security.ticker}</small>
												</span>
												<span aria-hidden="true">›</span>
											</Link>
										) : (
											<span
												className="search-result__link disabled"
												aria-disabled="true"
											>
												<span className="search-result__security">
													<strong>{security.name}</strong>
													<small>{security.ticker}</small>
												</span>
											</span>
										)}
									</div>
								);
							})}
						</section>
					) : (
						<div className="empty-state search-empty">
							<Search />
							<strong>找不到符合的證券</strong>
							<span>請嘗試輸入其他名稱或代號。</span>
						</div>
					)
				) : (
					<div className="empty-state search-empty">
						<Search />
						<strong>搜尋證券</strong>
						<span>輸入股票代號或名稱以查看結果。</span>
					</div>
				)}
			</main>
			<MainNavigation active="watchlist" />
		</>
	);
}
