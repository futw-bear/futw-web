import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MainNavigation } from "#/components/app-shell";
import { getStoredSecurities, searchSecurities } from "#/lib/security-search";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
	const [query, setQuery] = useState("");
	const [securities, setSecurities] = useState(() => getStoredSecurities());
	const normalizedQuery = query.trim();
	const results = useMemo(
		() => searchSecurities(securities, normalizedQuery),
		[normalizedQuery, securities],
	);

	useEffect(() => {
		const refreshSecurities = () => setSecurities(getStoredSecurities());
		window.addEventListener("storage", refreshSecurities);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshSecurities);

		return () => {
			window.removeEventListener("storage", refreshSecurities);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshSecurities);
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
							{results.map((security) => (
								<Link
									className="search-result"
									key={security.ticker}
									to="/stocks/$ticker"
									params={{ ticker: security.ticker }}
								>
									<span className="search-result__security">
										<strong>{security.name}</strong>
										<small>{security.ticker}</small>
									</span>
									<span aria-hidden="true">›</span>
								</Link>
							))}
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
