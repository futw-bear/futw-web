import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Heart, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { downloadStockQuote, type StockQuote } from "#/lib/stock-quote";

export const Route = createFileRoute("/stocks/$ticker")({
	component: StockDetailPage,
});

function StockChart() {
	return (
		<svg
			className="price-chart"
			viewBox="0 0 358 252"
			role="img"
			aria-label="台積電五日股價走勢"
		>
			<defs>
				<linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="oklch(63% 0.17 245 / 0.26)" />
					<stop offset="100%" stopColor="oklch(63% 0.17 245 / 0.05)" />
				</linearGradient>
			</defs>
			<rect width="358" height="252" className="chart-background" />
			<g className="chart-grid">
				<path d="M44 22v184M111 22v184M178 22v184M245 22v184M312 22v184" />
				<path d="M34 36h300M34 82h300M34 128h300M34 174h300M34 206h300" />
			</g>
			<g className="chart-price-labels">
				<text x="7" y="40">
					1,050
				</text>
				<text x="7" y="86">
					1,035
				</text>
				<text x="7" y="132">
					1,020
				</text>
				<text x="7" y="178">
					1,005
				</text>
			</g>
			<path
				d="M35 192 C52 178 57 160 69 170 C82 184 92 156 104 146 C119 134 134 140 145 122 C161 94 174 102 188 84 C205 60 221 68 238 70 C254 72 266 54 280 72 C292 88 301 112 314 132 C325 149 333 128 342 116 L342 206 L35 206 Z"
				fill="url(#priceFill)"
			/>
			<path
				className="price-line"
				d="M35 192 C52 178 57 160 69 170 C82 184 92 156 104 146 C119 134 134 140 145 122 C161 94 174 102 188 84 C205 60 221 68 238 70 C254 72 266 54 280 72 C292 88 301 112 314 132 C325 149 333 128 342 116"
			/>
			<path
				className="average-line"
				d="M35 184 C72 176 94 162 120 150 C154 136 179 122 208 100 C238 82 268 88 300 104 C318 114 333 112 342 108"
			/>
			<path className="current-price-line" d="M34 99h300" />
			<g className="chart-date-labels">
				<text x="35" y="232">
					06/28
				</text>
				<text x="113" y="232">
					07/01
				</text>
				<text x="194" y="232">
					07/03
				</text>
				<text x="292" y="232">
					07/04
				</text>
			</g>
		</svg>
	);
}

function StockDetailPage() {
	const { ticker } = Route.useParams();
	const [serverCredentials] = useState(() =>
		getAuthenticatedServerCredentials(),
	);
	const [quote, setQuote] = useState<StockQuote>({
		name: ticker,
		symbol: ticker,
		closePrice: "--",
		change: "--",
		changePercent: "--",
		highPrice: "--",
		lowPrice: "--",
		openPrice: "--",
		previousClose: "--",
		direction: "neutral",
	});
	const [isLoading, setIsLoading] = useState(serverCredentials !== null);
	const [error, setError] = useState(false);
	const [favorite, setFavorite] = useState(true);
	const [range, setRange] = useState("5日");
	const ranges = ["5日", "日K", "週K", "月K"];

	useEffect(() => {
		if (!serverCredentials) return;
		let cancelled = false;
		setError(false);
		void downloadStockQuote(ticker, serverCredentials)
			.then((downloadedQuote) => {
				if (!cancelled) setQuote(downloadedQuote);
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
	}, [serverCredentials, ticker]);

	if (!serverCredentials) {
		return (
			<main className="app-page stock-detail-page">
				<header className="stock-toolbar">
					<Link className="icon-button" to="/" aria-label="返回自選">
						<ChevronLeft />
					</Link>
					<Link className="icon-button" to="/search" aria-label="搜尋">
						<Search />
					</Link>
				</header>
				<div className="empty-state" role="alert">
					<strong>請先登入帳戶</strong>
					<span>登入後即可查看個股即時行情。</span>
				</div>
			</main>
		);
	}

	return (
		<>
			<main className="app-page stock-detail-page">
				<header className="stock-toolbar">
					<Link className="icon-button" to="/" aria-label="返回自選">
						<ChevronLeft />
					</Link>
					<Link className="icon-button" to="/search" aria-label="搜尋">
						<Search />
					</Link>
				</header>

				<nav className="stock-tabs" aria-label="個股資訊分頁">
					<button className="active" type="button">
						圖表
					</button>
					<button type="button">即時交易</button>
				</nav>
				{error && (
					<div className="market-data-state" role="alert">
						個股即時行情暫時無法取得，請稍後再試。
					</div>
				)}

				<section
					className="security-summary"
					aria-label="股票報價"
					aria-busy={isLoading}
				>
					<div className="stock-name">
						<h1>{quote.name}</h1>
						<span>{quote.symbol}</span>
					</div>
					<p>{isLoading ? "正在載入即時報價…" : "即時報價"}</p>
					<div className="quote-row">
						<div className={`main-quote ${quote.direction}`}>
							<strong>{quote.closePrice}</strong>
							<span>
								{quote.change} {quote.changePercent}
							</span>
						</div>
						<div className="quote-metrics">
							<span>
								<small>最高</small>
								<strong className="gain">{quote.highPrice}</strong>
							</span>
							<span>
								<small>開盤</small>
								<strong>{quote.openPrice}</strong>
							</span>
							<span>
								<small>最低</small>
								<strong className="loss">{quote.lowPrice}</strong>
							</span>
							<span>
								<small>昨收</small>
								<strong>{quote.previousClose}</strong>
							</span>
						</div>
					</div>
				</section>

				<nav className="range-tabs" aria-label="圖表區間">
					{ranges.map((item, index) => (
						<span key={item} className="range-option">
							<button
								type="button"
								className={range === item ? "active" : undefined}
								onClick={() => setRange(item)}
							>
								{item}
							</button>
							{index === 0 && (
								<select aria-label="選擇分鐘 K 線">
									<option>5 分K</option>
									<option>10 分K</option>
									<option>15 分K</option>
									<option>30 分K</option>
									<option>60 分K</option>
								</select>
							)}
						</span>
					))}
				</nav>

				<section className="stock-chart-card" aria-label={`${range}走勢圖`}>
					<StockChart />
				</section>
			</main>

			<footer className="stock-bottom-bar">
				<div className="stock-bottom-bar__inner">
					<button
						className={`footer-favorite ${favorite ? "selected" : ""}`}
						type="button"
						onClick={() => setFavorite((value) => !value)}
						aria-label={favorite ? "從自選列表移除" : "加入自選列表"}
					>
						<Heart fill={favorite ? "currentColor" : "none"} />
					</button>
					<button className="trade-button" type="button">
						查看交易
					</button>
				</div>
			</footer>
		</>
	);
}
