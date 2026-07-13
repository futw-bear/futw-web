import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";

import { MainNavigation, PageHeader } from "#/components/app-shell";

export const Route = createFileRoute("/market")({ component: MarketPage });

const indexes = [
	{
		name: "加權指數",
		value: "23,184.62",
		change: "+111.04",
		percent: "+0.48%",
		direction: "gain",
		compact: false,
		path: "M0 24 C12 21 18 24 28 19 C39 12 48 16 58 12 C73 6 84 14 98 9 C112 5 122 8 148 4",
	},
	{
		name: "櫃買指數",
		value: "276.84",
		change: "-0.50",
		percent: "-0.18%",
		direction: "loss",
		compact: false,
		path: "M0 20 C15 16 23 18 35 15 C51 12 62 18 77 15 C93 12 105 21 119 19 C130 18 139 23 148 21",
	},
	{
		name: "電子指數",
		value: "1,286.70",
		change: "+9.20",
		percent: "+0.72%",
		direction: "gain",
		compact: true,
		path: "M0 18 C8 15 15 17 22 12 C34 5 43 12 54 8 C66 4 76 7 92 3",
	},
	{
		name: "金融指數",
		value: "2,148.30",
		change: "+4.50",
		percent: "+0.21%",
		direction: "gain",
		compact: true,
		path: "M0 14 C10 12 17 15 27 13 C40 10 48 12 59 9 C72 8 80 10 92 7",
	},
	{
		name: "半導體指數",
		value: "682.90",
		change: "+7.43",
		percent: "+1.10%",
		direction: "gain",
		compact: true,
		path: "M0 20 C9 17 15 18 25 12 C36 5 44 9 54 6 C66 2 78 5 92 4",
	},
];

function IndexCard({ index }: { index: (typeof indexes)[number] }) {
	return (
		<article className={`index-card ${index.compact ? "compact" : ""}`}>
			<span>{index.name}</span>
			<strong className={index.direction}>{index.value}</strong>
			<span className={`index-delta ${index.direction}`}>
				<strong>{index.change}</strong>
				<small>({index.percent})</small>
			</span>
			<svg
				className="index-sparkline"
				viewBox={index.compact ? "0 0 92 24" : "0 0 148 34"}
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{!index.compact && (
					<path
						className={`index-fill ${index.direction}`}
						d={`M0 31 ${index.path} L148 34 L0 34 Z`}
					/>
				)}
				<path
					className={`index-line ${index.direction}`}
					d={index.path}
					fill="none"
					strokeWidth="2.4"
				/>
			</svg>
		</article>
	);
}

function MarketPage() {
	return (
		<>
			<main className="app-page market-page">
				<PageHeader
					title="市場"
					action={
						<button className="icon-button" type="button" aria-label="篩選">
							<SlidersHorizontal />
						</button>
					}
				/>
				<section className="index-board" aria-label="市場指數">
					<div className="index-row primary">
						{indexes.slice(0, 2).map((index) => (
							<IndexCard key={index.name} index={index} />
						))}
					</div>
					<div className="index-row secondary">
						{indexes.slice(2).map((index) => (
							<IndexCard key={index.name} index={index} />
						))}
					</div>
				</section>
			</main>
			<MainNavigation active="market" />
		</>
	);
}
