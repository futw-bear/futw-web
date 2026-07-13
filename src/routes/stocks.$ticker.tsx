import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Heart, Search } from "lucide-react";
import { useState } from "react";

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
	const [favorite, setFavorite] = useState(true);
	const [range, setRange] = useState("5日");
	const ranges = ["5日", "日K", "週K", "月K"];

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

				<section className="security-summary" aria-label="股票報價">
					<div className="stock-name">
						<h1>台積電</h1>
						<span>2330</span>
					</div>
					<p>收盤價 07/04 13:30:00（台北）</p>
					<div className="quote-row">
						<div className="main-quote">
							<strong>1,035.00</strong>
							<span>+15.00 +1.47%</span>
						</div>
						<div className="quote-metrics">
							<span>
								<small>最高</small>
								<strong className="gain">1,040.00</strong>
							</span>
							<span>
								<small>開盤</small>
								<strong>1,025.00</strong>
							</span>
							<span>
								<small>最低</small>
								<strong className="loss">1,020.00</strong>
							</span>
							<span>
								<small>昨收</small>
								<strong>1,020.00</strong>
							</span>
						</div>
					</div>
				</section>

				<section className="stock-metric-grid" aria-label="行情指標">
					<span>
						<small>成交額</small>
						<strong>486.2億</strong>
					</span>
					<span>
						<small>本益比 PE</small>
						<strong>25.8</strong>
					</span>
					<span>
						<small>股價淨值比 PB</small>
						<strong>26.84</strong>
					</span>
					<span>
						<small>成交量</small>
						<strong>46,872張</strong>
					</span>
					<span>
						<small>52 周最高</small>
						<strong>1,100.00</strong>
					</span>
					<span>
						<small>52 周最低</small>
						<strong>762.00</strong>
					</span>
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
