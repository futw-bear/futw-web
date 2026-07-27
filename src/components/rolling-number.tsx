import { useEffect, useRef, useState } from "react";

type RollingNumberProps = {
	value: string;
};

type NumberTransition = {
	direction: "up" | "down";
	from: string;
	to: string;
};

function parseFormattedNumber(value: string) {
	const parsed = Number(value.replaceAll(",", ""));
	return Number.isFinite(parsed) ? parsed : null;
}

export function RollingNumber({ value }: RollingNumberProps) {
	const [displayedValue, setDisplayedValue] = useState(value);
	const [transition, setTransition] = useState<NumberTransition | null>(null);
	const latestValue = useRef(value);

	useEffect(() => {
		const previousValue = latestValue.current;
		if (value === previousValue) return;
		latestValue.current = value;
		const previousNumber = parseFormattedNumber(previousValue);
		const nextNumber = parseFormattedNumber(value);
		if (
			previousNumber === null ||
			nextNumber === null ||
			previousNumber === nextNumber
		) {
			setDisplayedValue(value);
			setTransition(null);
			return;
		}
		setTransition({
			direction: nextNumber > previousNumber ? "up" : "down",
			from: previousValue,
			to: value,
		});
	}, [value]);

	if (!transition) {
		return <span className="rolling-number">{displayedValue}</span>;
	}

	return (
		<span
			className="rolling-number rolling-number--active"
			data-roll-direction={transition.direction}
		>
			<span
				className="rolling-number__value rolling-number__value--outgoing"
				aria-hidden="true"
			>
				{transition.from}
			</span>
			<span
				className="rolling-number__value rolling-number__value--incoming"
				onAnimationEnd={() => {
					setDisplayedValue(transition.to);
					setTransition(null);
				}}
			>
				{transition.to}
			</span>
		</span>
	);
}
