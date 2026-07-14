import { Link, useNavigate } from "@tanstack/react-router";
import { Globe2, Heart, UserRound, X } from "lucide-react";
import {
	type FormEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	authenticateServer,
	getAuthenticatedServerCredentials,
	getStoredServerCredentials,
	InvalidServerAddressError,
	storeServerCredentials,
} from "#/lib/server-auth";

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
	const navigate = useNavigate();
	const [isLoginOpen, setIsLoginOpen] = useState(false);
	const links = [
		{ key: "watchlist" as const, to: "/", label: "自選", icon: Heart },
		{ key: "market" as const, to: "/market", label: "市場", icon: Globe2 },
		{ key: "account" as const, to: "/account", label: "帳戶", icon: UserRound },
	];
	const openAccountLogin = (event: MouseEvent<HTMLAnchorElement>) => {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		if (getAuthenticatedServerCredentials()) return;
		event.preventDefault();
		setIsLoginOpen(true);
	};

	return (
		<>
			<nav className="main-navigation" aria-label="主要導覽">
				<div className="main-navigation__inner">
					{links.map(({ key, to, label, icon: Icon }) => (
						<Link
							key={key}
							to={to}
							className={active === key ? "active" : undefined}
							onClick={key === "account" ? openAccountLogin : undefined}
						>
							<Icon fill={key === "watchlist" ? "currentColor" : "none"} />
							<span>{label}</span>
						</Link>
					))}
				</div>
			</nav>
			{isLoginOpen && (
				<ServerLoginModal
					onClose={() => setIsLoginOpen(false)}
					onAuthenticated={() => {
						setIsLoginOpen(false);
						void navigate({ to: "/account" });
					}}
				/>
			)}
		</>
	);
}

function ServerLoginModal({
	onClose,
	onAuthenticated,
}: {
	onClose: () => void;
	onAuthenticated: () => void;
}) {
	const storedCredentials = getStoredServerCredentials();
	const [serverAddress, setServerAddress] = useState(
		storedCredentials.serverAddress,
	);
	const [authPassword, setAuthPassword] = useState(
		storedCredentials.authPassword,
	);
	const [errorMessage, setErrorMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const serverAddressInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const previouslyFocusedElement =
			document.activeElement as HTMLElement | null;
		serverAddressInputRef.current?.focus();
		document.body.classList.add("modal-open");

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isSubmitting) onClose();
		};
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.body.classList.remove("modal-open");
			document.removeEventListener("keydown", closeOnEscape);
			previouslyFocusedElement?.focus();
		};
	}, [isSubmitting, onClose]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage("");
		setIsSubmitting(true);

		try {
			const result = await authenticateServer({ serverAddress, authPassword });
			if (!result.authenticated) {
				setErrorMessage("認證失敗，請確認伺服器位址與認證密碼。");
				return;
			}

			storeServerCredentials(result.serverAddress, authPassword);
			onAuthenticated();
		} catch (error) {
			setErrorMessage(
				error instanceof InvalidServerAddressError
					? "請輸入有效的伺服器位址，並包含 http:// 或 https://。"
					: "無法連線至伺服器，請確認位址與網路狀態。",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="login-modal-backdrop">
			<section
				className="login-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="server-login-title"
			>
				<div className="login-modal__header">
					<div>
						<h2 id="server-login-title">登入帳戶</h2>
						<p>連線至您的資料伺服器以取得帳戶資訊。</p>
					</div>
					<button
						className="login-modal__close"
						type="button"
						aria-label="關閉登入視窗"
						disabled={isSubmitting}
						onClick={onClose}
					>
						<X />
					</button>
				</div>

				<form className="login-form" onSubmit={handleSubmit}>
					<label>
						<span>伺服器位址</span>
						<input
							ref={serverAddressInputRef}
							type="url"
							name="serverAddress"
							placeholder="https://example.com"
							autoComplete="url"
							required
							disabled={isSubmitting}
							value={serverAddress}
							onChange={(event) => setServerAddress(event.target.value)}
						/>
					</label>
					<label>
						<span>認證密碼</span>
						<input
							type="password"
							name="authPassword"
							autoComplete="current-password"
							required
							disabled={isSubmitting}
							value={authPassword}
							onChange={(event) => setAuthPassword(event.target.value)}
						/>
					</label>

					{errorMessage && (
						<p className="login-form__error" role="alert">
							{errorMessage}
						</p>
					)}

					<div className="login-form__actions">
						<button type="button" disabled={isSubmitting} onClick={onClose}>
							取消
						</button>
						<button className="primary" type="submit" disabled={isSubmitting}>
							{isSubmitting ? "登入中…" : "登入"}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}
