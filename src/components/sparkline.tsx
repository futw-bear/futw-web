export function Sparkline({
	direction,
	path,
}: {
	direction: "gain" | "loss";
	path: string;
}) {
	const points = path.replace(/^M\d+ \d+ /, "");

	return (
		<svg viewBox="0 0 82 34" aria-hidden="true">
			<path
				className={`spark-fill ${direction}`}
				d={`M1 34 L1 24 ${points} L81 34 Z`}
			/>
			<path
				className={`spark-stroke ${direction}`}
				d={path}
				fill="none"
				strokeWidth="2.5"
			/>
		</svg>
	);
}
