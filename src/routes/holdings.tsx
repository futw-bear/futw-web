import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MainNavigation } from "#/components/app-shell";

export const Route = createFileRoute("/holdings")({ component: HoldingsPage });

const holdings = [
	{ name: "富邦台 50", ticker: "006208", shares: "6,067", value: "1,524,940" },
	{ name: "台積電", ticker: "2330", shares: "200", value: "489,000" },
	{
		name: "國泰 20 年美債",
		ticker: "00687B",
		shares: "4,308",
		value: "121,270",
	},
	{ name: "元大高股息", ticker: "0056", shares: "1,399", value: "73,937" },
	{ name: "元大台灣50", ticker: "0050", shares: "260", value: "178,840" },
	{ name: "中華電", ticker: "2412", shares: "900", value: "61,500" },
	{ name: "玉山金", ticker: "2884", shares: "2,000", value: "35,000" },
	{ name: "中信金", ticker: "2891", shares: "1,500", value: "24,392" },
];

function HoldingsPage() {
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

				<section className="asset-card" aria-label="資產分佈摘要">
					<div className="asset-total">
						<span>總資產</span>
						<strong>
							<small>TWD</small>2,508,879
						</strong>
					</div>
					<div className="distribution-chart">
						<span className="distribution-pie" aria-hidden="true" />
						<span className="distribution-legend">
							<span>
								<i className="blue" />
								富邦台 50<strong>60.8%</strong>
							</span>
							<span>
								<i className="cyan" />
								台積電<strong>19.5%</strong>
							</span>
							<span>
								<i className="green" />
								國泰 20 年美債<strong>4.8%</strong>
							</span>
							<span>
								<i className="gold" />
								元大高股息<strong>2.9%</strong>
							</span>
							<span>
								<i className="accent" />
								元大台灣50<strong>7.1%</strong>
							</span>
							<span>
								<i className="rose" />
								其他<strong>4.8%</strong>
							</span>
						</span>
					</div>
				</section>

				<section className="holdings-card" aria-label="所有持股">
					<div className="holdings-title">
						<h2>所有持股</h2>
					</div>
					<div className="holdings-columns" aria-hidden="true">
						<span>
							證券名稱 <b>▽</b>
						</span>
						<span>
							餘額 <b>▽</b>
						</span>
						<span>
							市值 <b>▼</b>
						</span>
					</div>
					{holdings.map((holding) => (
						<Link
							className="holding-row"
							to="/stocks/$ticker"
							params={{ ticker: holding.ticker }}
							key={holding.ticker}
						>
							<span className="holding-security">
								<strong>{holding.name}</strong>
								<small>{holding.ticker}</small>
							</span>
							<strong>{holding.shares}</strong>
							<strong>
								{holding.value}
								<ChevronRight />
							</strong>
						</Link>
					))}
				</section>
			</main>
			<MainNavigation active="account" />
		</>
	);
}
