import { useEffect, useMemo, useRef } from "react";

import type { Candle, CandleTimeframe } from "#/lib/candles";

const CHART_HEIGHT = 320;
const LEFT_GUTTER = 62;
const RIGHT_GUTTER = 18;
const TOP_GUTTER = 18;
const BOTTOM_GUTTER = 38;

function formatPrice(value: number) {
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function formatTime(
	time: number,
	timeframe: CandleTimeframe,
	isIntraday: boolean,
) {
	if (isIntraday) {
		const hour = new Intl.DateTimeFormat("en-GB", {
			timeZone: "Asia/Taipei",
			hour: "2-digit",
			hourCycle: "h23",
		}).format(new Date(time));
		return `${hour}:00`;
	}
	const dateOptions: Intl.DateTimeFormatOptions = {
		timeZone: "Asia/Taipei",
		month: "2-digit",
		...(timeframe === "D" || timeframe === "W" || timeframe === "M"
			? { year: "2-digit" }
			: { day: "2-digit" }),
		...((timeframe !== "1" || isIntraday) &&
		timeframe !== "30" &&
		timeframe !== "60" &&
		timeframe !== "D" &&
		timeframe !== "W" &&
		timeframe !== "M"
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: {}),
	};
	return new Intl.DateTimeFormat("zh-TW", dateOptions).format(new Date(time));
}

export function getTimeframeLabel(timeframe: CandleTimeframe) {
	if (timeframe === "1") return "5日";
	if (timeframe === "D") return "日線";
	if (timeframe === "W") return "週線";
	if (timeframe === "M") return "月線";
	return `${timeframe} 分`;
}

function getTaipeiPeriodKey(time: number, timeframe: CandleTimeframe) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(time));
	const year = Number(parts.find((part) => part.type === "year")?.value);
	const month = Number(parts.find((part) => part.type === "month")?.value);
	const day = Number(parts.find((part) => part.type === "day")?.value);
	if (timeframe === "1" || timeframe === "30" || timeframe === "60") {
		return `${year}-${month}-${day}`;
	}
	if (timeframe === "D") return `${year}-${month}`;
	if (timeframe === "W" || timeframe === "M") {
		return `${year}-${Math.floor((month - 1) / 3)}`;
	}
	return null;
}

function getTaipeiHourKey(time: number) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(time));
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	return `${value("year")}-${value("month")}-${value("day")}-${value("hour")}`;
}

export function getTimeTickIndexes(
	candles: Candle[],
	timeframe: CandleTimeframe,
	isIntraday = false,
) {
	if (candles.length === 0) return [];
	if (isIntraday) {
		const indexes: number[] = [];
		let previousHour: string | null = null;
		for (const [index, candle] of candles.entries()) {
			const hour = getTaipeiHourKey(candle.time);
			if (hour !== previousHour) indexes.push(index);
			previousHour = hour;
		}
		return indexes;
	}
	if (
		(timeframe === "1" && !isIntraday) ||
		timeframe === "30" ||
		timeframe === "60" ||
		timeframe === "D" ||
		timeframe === "W" ||
		timeframe === "M"
	) {
		const indexes: number[] = [];
		let previousKey: string | null = null;
		for (const [index, candle] of candles.entries()) {
			const key = getTaipeiPeriodKey(candle.time, timeframe);
			if (key !== previousKey) indexes.push(index);
			previousKey = key;
		}
		return indexes;
	}

	const step = Math.max(1, Math.ceil(candles.length / 6));
	return candles
		.map((_, index) => index)
		.filter((index) => index % step === 0 || index === candles.length - 1);
}

export function getPriceScale(candles: Candle[], timeframe: CandleTimeframe) {
	const lowestPrice = Math.min(...candles.map((candle) => candle.low));
	const highestPrice = Math.max(...candles.map((candle) => candle.high));
	const isMinuteTimeframe =
		timeframe !== "D" && timeframe !== "W" && timeframe !== "M";
	const minimumPrice = isMinuteTimeframe ? lowestPrice : lowestPrice * 0.95;
	const maximumPrice = isMinuteTimeframe ? highestPrice : highestPrice * 1.05;
	const priceRange = maximumPrice - minimumPrice;
	return {
		minimumPrice,
		maximumPrice,
		priceRange,
		priceTicks:
			priceRange === 0
				? [maximumPrice]
				: [1, 0.75, 0.5, 0.25, 0].map(
						(ratio) => minimumPrice + priceRange * ratio,
					),
	};
}

export function CandlestickChart({
	candles,
	timeframe,
	isIntraday = false,
	isLoading,
	error,
}: {
	candles: Candle[];
	timeframe: CandleTimeframe;
	isIntraday?: boolean;
	isLoading: boolean;
	error: boolean;
}) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const chart = useMemo(() => {
		if (candles.length === 0) return null;
		const isFiveDay = timeframe === "1" && !isIntraday;
		const { maximumPrice, priceRange, priceTicks } = getPriceScale(
			candles,
			timeframe,
		);
		const width = isFiveDay
			? 358
			: Math.max(358, LEFT_GUTTER + RIGHT_GUTTER + candles.length * 9);
		const plotWidth = width - LEFT_GUTTER - RIGHT_GUTTER;
		const plotHeight = CHART_HEIGHT - TOP_GUTTER - BOTTOM_GUTTER;
		const candleStep = plotWidth / candles.length;
		const candleWidth = Math.max(2, Math.min(6, candleStep * 0.68));
		const getY = (price: number) =>
			priceRange === 0
				? TOP_GUTTER + plotHeight / 2
				: TOP_GUTTER + ((maximumPrice - price) / priceRange) * plotHeight;
		const getX = (index: number) => LEFT_GUTTER + (index + 0.5) * candleStep;
		const positionedPriceTicks = priceTicks.map((price) => ({
			price,
			y: getY(price),
		}));
		const timeTickIndexes = getTimeTickIndexes(candles, timeframe, isIntraday);
		const linePoints = isFiveDay
			? candles
					.map((candle, index) => `${getX(index)},${getY(candle.close)}`)
					.join(" ")
			: null;

		return {
			width,
			plotWidth,
			plotHeight,
			candleStep,
			candleWidth,
			getX,
			getY,
			linePoints,
			isFiveDay,
			priceTicks: positionedPriceTicks,
			timeTickIndexes,
		};
	}, [candles, isIntraday, timeframe]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (container && chart) container.scrollLeft = container.scrollWidth;
	}, [chart]);

	if (isLoading) {
		return <div className="candlestick-state">正在載入圖表資料…</div>;
	}
	if (error) {
		return (
			<div className="candlestick-state" role="alert">
				圖表資料暫時無法取得，請稍後再試。
			</div>
		);
	}
	if (!chart || candles.length === 0) {
		return <div className="candlestick-state">目前沒有可顯示的圖表資料。</div>;
	}

	return (
		<div className="candlestick-scroll" ref={scrollContainerRef}>
			<svg
				className="candlestick-chart"
				width={chart.width}
				height={CHART_HEIGHT}
				viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
				role="img"
				aria-label={
					isIntraday
						? `${timeframe} 分線圖`
						: `${getTimeframeLabel(timeframe)}圖`
				}
			>
				<rect
					width={chart.width}
					height={CHART_HEIGHT}
					className="chart-background"
				/>
				<g className="candlestick-grid">
					{chart.priceTicks.map(({ price, y }) => (
						<g key={price}>
							<line
								x1={LEFT_GUTTER}
								x2={chart.width - RIGHT_GUTTER}
								y1={y}
								y2={y}
							/>
							<text x={LEFT_GUTTER - 8} y={y + 4} textAnchor="end">
								{formatPrice(price)}
							</text>
						</g>
					))}
					{chart.timeTickIndexes.map((index) => {
						const x = chart.getX(index);
						return (
							<g key={candles[index].time}>
								<line
									x1={x}
									x2={x}
									y1={TOP_GUTTER}
									y2={TOP_GUTTER + chart.plotHeight}
								/>
								<text x={x} y={CHART_HEIGHT - 12} textAnchor="middle">
									{formatTime(candles[index].time, timeframe, isIntraday)}
								</text>
							</g>
						);
					})}
				</g>
				{chart.isFiveDay ? (
					<g>
						<title>5日收盤價折線圖</title>
						<polyline
							className="five-day-price-line"
							points={chart.linePoints ?? ""}
						/>
					</g>
				) : (
					<g>
						{candles.map((candle, index) => {
							const x = chart.getX(index);
							const openY = chart.getY(candle.open);
							const closeY = chart.getY(candle.close);
							const direction =
								candle.close === candle.open
									? "neutral"
									: candle.close > candle.open
										? "gain"
										: "loss";
							return (
								<g className={`candlestick ${direction}`} key={candle.time}>
									<title>{`${formatTime(candle.time, timeframe, isIntraday)} 開 ${formatPrice(candle.open)} 高 ${formatPrice(candle.high)} 低 ${formatPrice(candle.low)} 收 ${formatPrice(candle.close)}`}</title>
									<line
										x1={x}
										x2={x}
										y1={chart.getY(candle.high)}
										y2={chart.getY(candle.low)}
									/>
									<rect
										x={x - chart.candleWidth / 2}
										y={Math.min(openY, closeY)}
										width={chart.candleWidth}
										height={Math.max(1, Math.abs(closeY - openY))}
									/>
								</g>
							);
						})}
					</g>
				)}
			</svg>
		</div>
	);
}
