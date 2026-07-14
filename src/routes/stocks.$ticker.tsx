import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, Heart, Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
	CandlestickChart,
	getTimeframeLabel,
} from "#/components/candlestick-chart";
import {
	CANDLE_MINUTE_TIMEFRAMES,
	type Candle,
	type CandleTimeframe,
	downloadCandlesForMarketSession,
	type MarketSession,
} from "#/lib/candles";
import { getAuthenticatedServerCredentials } from "#/lib/server-auth";
import { downloadStockQuote, type StockQuote } from "#/lib/stock-quote";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";
import { getStoredWatchlist, toggleWatchlistTicker } from "#/lib/watchlist";

export const Route = createFileRoute("/stocks/$ticker")({
	component: StockDetailPage,
});

function formatTaipeiDateTime(timestampMicroseconds: number | null) {
	if (timestampMicroseconds === null) return null;
	const date = new Date(timestampMicroseconds / 1_000);
	if (Number.isNaN(date.getTime())) return null;

	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Taipei",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "--";

	return `${value("month")}/${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
}

function BackButton() {
	const navigate = useNavigate();
	const router = useRouter();

	const handleBack = () => {
		if (router.history.canGoBack()) {
			router.history.back();
			return;
		}

		void navigate({ to: "/" });
	};

	return (
		<button
			className="icon-button"
			type="button"
			onClick={handleBack}
			aria-label="返回上一頁"
		>
			<ChevronLeft />
		</button>
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
		isClose: false,
		lastUpdated: null,
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
	const [candles, setCandles] = useState<Candle[]>([]);
	const [timeframe, setTimeframe] = useState<CandleTimeframe>("1");
	const [marketSession, setMarketSession] = useState<MarketSession | null>(
		null,
	);
	const [areCandlesLoading, setAreCandlesLoading] = useState(
		serverCredentials !== null,
	);
	const [candlesError, setCandlesError] = useState(false);
	const [favorite, setFavorite] = useState(() =>
		getStoredWatchlist().includes(ticker),
	);
	const isCandleMinuteTimeframe = CANDLE_MINUTE_TIMEFRAMES.some(
		(minuteTimeframe) => minuteTimeframe === timeframe,
	);
	const quoteUpdatedAt = formatTaipeiDateTime(quote.lastUpdated);
	const quoteStatus = isLoading
		? "正在載入即時報價…"
		: quote.isClose
			? `已收盤 ${quoteUpdatedAt ?? "--"}（台北）`
			: "即時報價";

	useEffect(() => {
		const refreshFavorite = () =>
			setFavorite(getStoredWatchlist().includes(ticker));
		refreshFavorite();
		window.addEventListener("storage", refreshFavorite);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshFavorite);

		return () => {
			window.removeEventListener("storage", refreshFavorite);
			window.removeEventListener(MARKET_DATA_UPDATED_EVENT, refreshFavorite);
		};
	}, [ticker]);

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

	useEffect(() => {
		if (!serverCredentials) return;
		let cancelled = false;
		setAreCandlesLoading(true);
		setCandlesError(false);
		void downloadCandlesForMarketSession({
			code: ticker,
			credentials: serverCredentials,
			timeframe,
		})
			.then((result) => {
				if (cancelled) return;
				setCandles(result.candles);
				setMarketSession(result.marketSession);
			})
			.catch(() => {
				if (!cancelled) setCandlesError(true);
			})
			.finally(() => {
				if (!cancelled) setAreCandlesLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [serverCredentials, ticker, timeframe]);

	if (!serverCredentials) {
		return (
			<main className="app-page stock-detail-page">
				<header className="stock-toolbar">
					<BackButton />
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
					<BackButton />
					<Link className="icon-button" to="/search" aria-label="搜尋">
						<Search />
					</Link>
				</header>

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
						<button
							className={`stock-favorite-button ${favorite ? "selected" : ""}`}
							type="button"
							aria-pressed={favorite}
							aria-label={favorite ? "從自選移除此股票" : "將此股票加入自選"}
							onClick={() =>
								setFavorite(toggleWatchlistTicker(ticker).includes(ticker))
							}
						>
							<Heart
								fill={favorite ? "currentColor" : "none"}
								aria-hidden="true"
							/>
						</button>
						<h1>{quote.name}</h1>
						<span>{quote.symbol}</span>
					</div>
					<p>{quoteStatus}</p>
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
					<span className="range-option">
						<button
							type="button"
							className={timeframe === "1" ? "active" : undefined}
							onClick={() => setTimeframe("1")}
						>
							5日
						</button>
					</span>
					<span className="range-option">
						<select
							aria-label="選擇分鐘 K 線"
							value={isCandleMinuteTimeframe ? timeframe : ""}
							onChange={(event) =>
								setTimeframe(event.target.value as CandleTimeframe)
							}
						>
							<option value="" disabled>
								分K
							</option>
							{CANDLE_MINUTE_TIMEFRAMES.map((minuteTimeframe) => (
								<option value={minuteTimeframe} key={minuteTimeframe}>
									{minuteTimeframe} 分K
								</option>
							))}
						</select>
					</span>
					{(["D", "W", "M"] as const).map((item) => (
						<span key={item} className="range-option">
							<button
								type="button"
								className={timeframe === item ? "active" : undefined}
								disabled={marketSession !== "closed"}
								onClick={() => setTimeframe(item)}
							>
								{getTimeframeLabel(item)}
							</button>
						</span>
					))}
				</nav>

				<section
					className="stock-chart-card"
					aria-label={`${getTimeframeLabel(timeframe)}走勢圖`}
				>
					<CandlestickChart
						candles={candles}
						timeframe={timeframe}
						isLoading={areCandlesLoading}
						error={candlesError}
					/>
				</section>
			</main>
		</>
	);
}
