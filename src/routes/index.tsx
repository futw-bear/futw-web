import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, CircleMinus, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { MainNavigation, PageHeader } from "#/components/app-shell";
import { RollingNumber } from "#/components/rolling-number";
import {
	downloadIntradayQuotes,
	type IntradayQuote,
	toIntradayQuoteDisplay,
} from "#/lib/intraday-quotes";
import {
	getAuthenticatedServerCredentials,
	normalizeServerAddress,
} from "#/lib/server-auth";
import { MARKET_DATA_UPDATED_EVENT } from "#/lib/storage-events";
import { getWatchlistStocks, removeWatchlistTicker } from "#/lib/watchlist";

const MARKET_DATA_RECONNECT_DELAY_MS = 3_000;
const INITIAL_QUOTES_RETRY_DELAY_MS = 10_000;
const INITIAL_QUOTES_MAX_RETRIES = 5;

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

function getMarketDataWebSocketUrl(serverAddress: string) {
	const url = new URL(normalizeServerAddress(serverAddress));
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.pathname = `${url.pathname}/proxy/market-data/ws`.replace(/\/{2,}/g, "/");
	url.search = "?mode=speed";
	return url.toString();
}

function getLiveQuoteDisplay(price: number, quote: IntradayQuote) {
	const change =
		quote.previousClose === null ? null : price - quote.previousClose;
	const changePercent =
		quote.previousClose === null || quote.previousClose === 0 || change === null
			? null
			: (change / quote.previousClose) * 100;

	return toIntradayQuoteDisplay({
		...quote,
		closePrice: price,
		change,
		changePercent,
	});
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
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let refreshVersion = 0;
		let marketDataSocket: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof window.setTimeout> | null = null;
		let initialQuotesRetryTimer: ReturnType<typeof window.setTimeout> | null =
			null;
		const closeMarketDataSocket = () => {
			if (reconnectTimer !== null) {
				window.clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			if (initialQuotesRetryTimer !== null) {
				window.clearTimeout(initialQuotesRetryTimer);
				initialQuotesRetryTimer = null;
			}
			if (marketDataSocket) {
				marketDataSocket.onclose = null;
				marketDataSocket.onerror = null;
				marketDataSocket.close();
			}
			marketDataSocket = null;
		};
		const refreshStocks = () => {
			const currentRefreshVersion = ++refreshVersion;
			closeMarketDataSocket();
			const storedStocks = getWatchlistStocks();
			setStocks(
				serverCredentials ? storedStocks.map(resetStockQuote) : storedStocks,
			);
			setLiveQuoteError(false);
			if (!serverCredentials) return;

			let initialQuotesRetryCount = 0;
			const loadInitialQuotes = () => {
				void downloadIntradayQuotes(
					storedStocks.map(({ ticker }) => ticker),
					serverCredentials,
				)
					.then((quotes) => {
						if (cancelled || currentRefreshVersion !== refreshVersion) return;
						setStocks(
							storedStocks.map((stock, index) => ({
								...stock,
								...toIntradayQuoteDisplay(quotes[index]),
							})),
						);
						if (
							quotes.every((quote) => quote.isClose) ||
							typeof WebSocket === "undefined"
						) {
							return;
						}

						const quotesByTicker = new Map(
							quotes.map((quote) => [quote.code, quote]),
						);
						const isCurrentRefresh = () =>
							!cancelled && currentRefreshVersion === refreshVersion;
						const scheduleReconnect = () => {
							if (!isCurrentRefresh() || reconnectTimer !== null) return;
							setLiveQuoteError(true);
							reconnectTimer = window.setTimeout(() => {
								reconnectTimer = null;
								void reconnectIfMarketOpen();
							}, MARKET_DATA_RECONNECT_DELAY_MS);
						};
						async function reconnectIfMarketOpen() {
							if (!isCurrentRefresh()) return;
							try {
								const latestQuotes = await downloadIntradayQuotes(
									storedStocks.map(({ ticker }) => ticker),
									serverCredentials,
								);
								if (!isCurrentRefresh()) return;
								setStocks(
									storedStocks.map((stock, index) => ({
										...stock,
										...toIntradayQuoteDisplay(latestQuotes[index]),
									})),
								);
								if (latestQuotes.every((quote) => quote.isClose)) {
									setLiveQuoteError(false);
									return;
								}
								quotesByTicker.clear();
								for (const quote of latestQuotes) {
									quotesByTicker.set(quote.code, quote);
								}
								connectMarketDataSocket();
							} catch {
								scheduleReconnect();
							}
						}
						function connectMarketDataSocket() {
							if (!isCurrentRefresh()) return;

							let socket: WebSocket;
							try {
								socket = new WebSocket(
									getMarketDataWebSocketUrl(serverCredentials.serverAddress),
								);
							} catch {
								scheduleReconnect();
								return;
							}
							marketDataSocket = socket;
							socket.onopen = () => {
								if (!isCurrentRefresh() || marketDataSocket !== socket) return;
								setLiveQuoteError(false);
								socket.send(
									JSON.stringify({
										event: "subscribe",
										data: {
											channel: "trades",
											symbols: storedStocks.map(({ ticker }) => ticker),
										},
									}),
								);
							};
							socket.onmessage = (event) => {
								if (!isCurrentRefresh() || marketDataSocket !== socket) return;
								try {
									const message: unknown = JSON.parse(String(event.data));
									if (
										typeof message !== "object" ||
										message === null ||
										!("event" in message) ||
										message.event !== "data" ||
										!("data" in message) ||
										typeof message.data !== "object" ||
										message.data === null ||
										!("symbol" in message.data) ||
										!("price" in message.data) ||
										typeof message.data.symbol !== "string" ||
										typeof message.data.price !== "number" ||
										!Number.isFinite(message.data.price)
									) {
										return;
									}

									const quote = quotesByTicker.get(message.data.symbol);
									if (!quote) return;
									setStocks((currentStocks) =>
										currentStocks.map((stock) =>
											stock.ticker === message.data.symbol
												? {
														...stock,
														...getLiveQuoteDisplay(message.data.price, quote),
													}
												: stock,
										),
									);
								} catch {
									// Ignore malformed WebSocket messages.
								}
							};
							socket.onerror = () => {
								if (!isCurrentRefresh() || marketDataSocket !== socket) return;
								scheduleReconnect();
								socket.close();
							};
							socket.onclose = () => {
								if (!isCurrentRefresh() || marketDataSocket !== socket) return;
								marketDataSocket = null;
								scheduleReconnect();
							};
						}
						connectMarketDataSocket();
					})
					.catch(() => {
						if (cancelled || currentRefreshVersion !== refreshVersion) return;
						setLiveQuoteError(true);
						if (initialQuotesRetryCount >= INITIAL_QUOTES_MAX_RETRIES) return;
						initialQuotesRetryCount += 1;
						initialQuotesRetryTimer = window.setTimeout(() => {
							initialQuotesRetryTimer = null;
							loadInitialQuotes();
						}, INITIAL_QUOTES_RETRY_DELAY_MS);
					});
			};
			loadInitialQuotes();
		};
		refreshStocks();
		window.addEventListener("storage", refreshStocks);
		window.addEventListener(MARKET_DATA_UPDATED_EVENT, refreshStocks);

		return () => {
			cancelled = true;
			closeMarketDataSocket();
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
							<div className={`security-name ${isEditing ? "editing" : ""}`}>
								{isEditing && (
									<button
										className="watchlist-remove-button"
										type="button"
										aria-label={`將${stock.name}移出自選列表`}
										onClick={() => removeWatchlistTicker(stock.ticker)}
									>
										<CircleMinus aria-hidden="true" />
									</button>
								)}
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
									<RollingNumber value={stock.price} />
								</Link>
							) : (
								<span
									className={`stock-price ${stock.direction}`}
									aria-disabled="true"
								>
									<RollingNumber value={stock.price} />
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
					<button
						type="button"
						aria-pressed={isEditing}
						onClick={() => setIsEditing((editing) => !editing)}
					>
						<Pencil />
						{isEditing ? "完成編輯" : "編輯自選"}
					</button>
				</div>
			</main>
			<MainNavigation active="watchlist" />
		</>
	);
}
