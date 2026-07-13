import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import { Sparkline } from "#/components/sparkline";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const [category, setCategory] = useState<"全部" | "證券" | "ETF">("全部");
	const stocks = useMemo(
		() => [
			{
				name: "台積電",
				ticker: "2330",
				price: "1,035.00",
				change: "+15.00",
				percent: "+1.47%",
				direction: "gain" as const,
				kind: "證券",
				path: "M1 21 L10 18 L19 20 L28 13 L37 16 L46 10 L55 12 L64 7 L81 4",
			},
			{
				name: "鴻海",
				ticker: "2317",
				price: "212.50",
				change: "+4.00",
				percent: "+1.92%",
				direction: "gain" as const,
				kind: "證券",
				path: "M1 22 L12 24 L24 19 L36 18 L48 13 L60 15 L72 10 L81 8",
			},
			{
				name: "元大台灣50",
				ticker: "0050",
				price: "196.80",
				change: "+0.85",
				percent: "+0.43%",
				direction: "gain" as const,
				kind: "ETF",
				path: "M1 26 L12 22 L24 20 L36 17 L48 14 L60 16 L72 12 L81 10",
			},
			{
				name: "聯發科",
				ticker: "2454",
				price: "1,375.00",
				change: "-20.00",
				percent: "-1.43%",
				direction: "loss" as const,
				kind: "證券",
				path: "M1 11 L13 14 L25 12 L37 17 L49 19 L61 21 L73 24 L81 28",
			},
			{
				name: "中華電",
				ticker: "2412",
				price: "126.00",
				change: "-0.50",
				percent: "-0.40%",
				direction: "loss" as const,
				kind: "證券",
				path: "M1 18 L15 17 L29 20 L43 18 L57 19 L69 22 L81 21",
			},
			{
				name: "玉山金",
				ticker: "2884",
				price: "31.20",
				change: "+0.15",
				percent: "+0.48%",
				direction: "gain" as const,
				kind: "證券",
				path: "M1 24 L12 22 L24 25 L36 20 L48 18 L60 17 L72 15 L81 13",
			},
		],
		[],
	);
	const visibleStocks = stocks.filter(
		(stock) => category === "全部" || stock.kind === category,
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

				<nav className="pill-tabs" aria-label="自選分類">
					{(["全部", "證券", "ETF"] as const).map((item) => (
						<button
							type="button"
							key={item}
							className={category === item ? "active" : undefined}
							onClick={() => setCategory(item)}
						>
							{item}
						</button>
					))}
				</nav>

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
						<Link
							className="watchlist-row"
							key={stock.ticker}
							to="/stocks/$ticker"
							params={{ ticker: stock.ticker }}
						>
							<span className="security-name">
								<strong>{stock.name}</strong>
								<small>{stock.ticker}</small>
							</span>
							<span className="sparkline">
								<Sparkline direction={stock.direction} path={stock.path} />
							</span>
							<strong className={`stock-price ${stock.direction}`}>
								{stock.price}
							</strong>
							<span className={`change-pill ${stock.direction}`}>
								<strong>{stock.change}</strong>
								<small>{stock.percent}</small>
							</span>
						</Link>
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
