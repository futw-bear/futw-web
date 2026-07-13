import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { MainNavigation } from "#/components/app-shell";

export const Route = createFileRoute("/search")({ component: SearchPage });

type RankedStock = {
	name: string;
	ticker: string;
	metric: string;
	tone?: "gain" | "loss";
};

const boards = [
	{
		title: "上市股熱度榜",
		groups: [
			{
				title: "成交量排行",
				unit: "張數",
				stocks: [
					{ name: "群創", ticker: "3481", metric: "218,420" },
					{ name: "長榮航", ticker: "2618", metric: "164,902" },
					{ name: "華航", ticker: "2610", metric: "143,771" },
					{ name: "台積電", ticker: "2330", metric: "121,335" },
					{ name: "金寶", ticker: "2312", metric: "98,614" },
				],
			},
			{
				title: "漲幅排行",
				unit: "漲跌幅",
				stocks: [
					{
						name: "世紀鋼",
						ticker: "9958",
						metric: "+9.91%",
						tone: "gain" as const,
					},
					{
						name: "智邦",
						ticker: "2345",
						metric: "+8.34%",
						tone: "gain" as const,
					},
					{
						name: "緯穎",
						ticker: "6669",
						metric: "+7.86%",
						tone: "gain" as const,
					},
					{
						name: "亞翔",
						ticker: "6139",
						metric: "+6.52%",
						tone: "gain" as const,
					},
					{
						name: "大同",
						ticker: "2371",
						metric: "-5.18%",
						tone: "loss" as const,
					},
				],
			},
		],
	},
	{
		title: "上櫃股熱度榜",
		groups: [
			{
				title: "成交量排行",
				unit: "張數",
				stocks: [
					{ name: "元太", ticker: "8069", metric: "88,412" },
					{ name: "世界", ticker: "5347", metric: "74,605" },
					{ name: "中光電", ticker: "5371", metric: "59,183" },
					{ name: "宜鼎", ticker: "5289", metric: "42,950" },
					{ name: "鈊象", ticker: "3293", metric: "36,284" },
				],
			},
			{
				title: "漲跌幅排行",
				unit: "漲跌幅",
				stocks: [
					{
						name: "雙鴻",
						ticker: "3324",
						metric: "+9.72%",
						tone: "gain" as const,
					},
					{
						name: "力旺",
						ticker: "3529",
						metric: "+8.16%",
						tone: "gain" as const,
					},
					{
						name: "精測",
						ticker: "6510",
						metric: "+7.45%",
						tone: "gain" as const,
					},
					{
						name: "信驊",
						ticker: "5274",
						metric: "+6.08%",
						tone: "gain" as const,
					},
					{
						name: "穩懋",
						ticker: "3105",
						metric: "-4.36%",
						tone: "loss" as const,
					},
				],
			},
		],
	},
];

function SearchPage() {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(() => new Set(["2330"]));
	const normalizedQuery = query.trim().toLowerCase();
	const results = useMemo(() => {
		if (!normalizedQuery) return boards;
		return boards
			.map((board) => ({
				...board,
				groups: board.groups
					.map((group) => ({
						...group,
						stocks: group.stocks.filter((stock) =>
							`${stock.name}${stock.ticker}`
								.toLowerCase()
								.includes(normalizedQuery),
						),
					}))
					.filter((group) => group.stocks.length > 0),
			}))
			.filter((board) => board.groups.length > 0);
	}, [normalizedQuery]);

	const toggleSelected = (ticker: string) => {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(ticker)) next.delete(ticker);
			else next.add(ticker);
			return next;
		});
	};

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
							placeholder="股票、ETF 等"
							aria-label="搜尋股票或 ETF"
						/>
					</label>
					<Link className="cancel-link" to="/">
						取消
					</Link>
				</div>

				{results.length > 0 ? (
					<section className="hot-scroll" aria-label="熱度榜">
						{results.map((board) => (
							<article className="hot-card" key={board.title}>
								<div className="hot-title">
									<h1>{board.title}</h1>
									<span aria-hidden="true">›</span>
								</div>
								<div className="leaderboards">
									{board.groups.map((group) => (
										<section
											className="ranking-board"
											key={group.title}
											aria-label={`${board.title}${group.title}`}
										>
											<div className="ranking-heading">
												<strong>{group.title}</strong>
												<span>{group.unit}</span>
											</div>
											{group.stocks.map((stock: RankedStock, index) => {
												const isSelected = selected.has(stock.ticker);
												return (
													<div
														className="ranking-row"
														key={`${group.title}-${stock.ticker}`}
													>
														<span className="rank-number">{index + 1}</span>
														<span className="ranked-security">
															<strong>{stock.name}</strong>
															<small>{stock.ticker}</small>
														</span>
														<strong
															className={`ranking-metric ${stock.tone ?? ""}`}
														>
															{stock.metric}
														</strong>
														<button
															type="button"
															className={`favorite-toggle ${isSelected ? "selected" : ""}`}
															onClick={() => toggleSelected(stock.ticker)}
															aria-label={
																isSelected
																	? `從自選移除${stock.name}`
																	: `加入${stock.name}至自選`
															}
														>
															<Heart
																fill={isSelected ? "currentColor" : "none"}
															/>
														</button>
													</div>
												);
											})}
										</section>
									))}
								</div>
							</article>
						))}
					</section>
				) : (
					<div className="empty-state search-empty">
						<Search />
						<strong>找不到符合的證券</strong>
						<span>請嘗試輸入其他名稱或代號。</span>
					</div>
				)}
				{!normalizedQuery && (
					<div className="pager" aria-hidden="true">
						<span className="active" />
						<span />
					</div>
				)}
			</main>
			<MainNavigation active="watchlist" />
		</>
	);
}
