import { Link } from "@tanstack/react-router";
import { Globe2, Heart, UserRound } from "lucide-react";
import type { ReactNode } from "react";

type NavigationKey = "watchlist" | "market" | "account";

export function BrandMark() {
  return (
    <picture className="brand-mark">
      <source srcSet="./logo192.webp" type="image/webp" />
      <img src="./android-chrome-192x192.png" alt="brand-icon"></img>
    </picture>
  );
}

export function PageHeader({
	title,
	action,
}: {
	title: string;
	action?: ReactNode;
}) {
	return (
		<header className="page-header">
			<div className="brand-lockup">
				<BrandMark />
				<h1>{title}</h1>
			</div>
			{action}
		</header>
	);
}

export function MainNavigation({ active }: { active: NavigationKey }) {
	const links = [
		{ key: "watchlist" as const, to: "/", label: "自選", icon: Heart },
		{ key: "market" as const, to: "/market", label: "市場", icon: Globe2 },
		{ key: "account" as const, to: "/account", label: "帳戶", icon: UserRound },
	];

	return (
		<nav className="main-navigation" aria-label="主要導覽">
			<div className="main-navigation__inner">
				{links.map(({ key, to, label, icon: Icon }) => (
					<Link
						key={key}
						to={to}
						className={active === key ? "active" : undefined}
					>
						<Icon fill={key === "watchlist" ? "currentColor" : "none"} />
						<span>{label}</span>
					</Link>
				))}
			</div>
		</nav>
	);
}
