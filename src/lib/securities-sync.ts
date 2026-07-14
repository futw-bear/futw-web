import {
	getAppServiceWorkerRegistration,
	getNextTaipeiRefreshAt,
	isRefreshDue,
	registerDailyPeriodicSync,
} from "./daily-sync";
import { notifyMarketDataUpdated } from "./storage-events";

export const SECURITIES_API_URLS = [
	"/api/pub/securities?type=2",
	"/api/pub/securities?type=4",
] as const;
export const SECURITIES_STORAGE_KEY = "securities";
export const SECURITIES_SYNCED_AT_KEY = "securities:last-synced-at";
export const SECURITIES_PERIODIC_SYNC_TAG = "refresh-securities";

type Fetcher = typeof fetch;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

type SecuritiesUpdatedMessage = {
	type: "SECURITIES_UPDATED";
	securities: unknown;
	syncedAt: string;
};

export type SecuritiesSnapshot = {
	securities: unknown;
	syncedAt: string;
};

export function isSecuritiesRefreshDue(
	lastSyncedAt: string | null,
	now = new Date(),
) {
	return isRefreshDue(lastSyncedAt, now, 8);
}

export function storeSecuritiesSnapshot(
	snapshot: SecuritiesSnapshot,
	storage: StorageLike = window.localStorage,
) {
	storage.setItem(SECURITIES_STORAGE_KEY, JSON.stringify(snapshot.securities));
	storage.setItem(SECURITIES_SYNCED_AT_KEY, snapshot.syncedAt);
	notifyMarketDataUpdated(storage);
}

export async function downloadSecurities(
	fetcher: Fetcher = fetch,
	now = new Date(),
): Promise<SecuritiesSnapshot> {
	const securities = await Promise.all(
		SECURITIES_API_URLS.map(async (url) => {
			const response = await fetcher(url, {
				cache: "no-store",
				headers: { accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error(`Unable to download securities: ${response.status}`);
			}
			const payload: unknown = await response.json();
			return Array.isArray(payload) ? payload : [];
		}),
	);

	return {
		securities: securities.flat(),
		syncedAt: now.toISOString(),
	};
}

export async function syncSecuritiesIfDue({
	now = new Date(),
	storage = window.localStorage,
	fetcher = fetch,
}: {
	now?: Date;
	storage?: StorageLike;
	fetcher?: Fetcher;
} = {}) {
	const hasSecurities = storage.getItem(SECURITIES_STORAGE_KEY) !== null;
	const lastSyncedAt = storage.getItem(SECURITIES_SYNCED_AT_KEY);

	if (hasSecurities && !isSecuritiesRefreshDue(lastSyncedAt, now)) {
		return null;
	}

	const snapshot = await downloadSecurities(fetcher, now);
	storeSecuritiesSnapshot(snapshot, storage);
	return snapshot;
}

function sendSnapshotToServiceWorker(
	registration: ServiceWorkerRegistration,
	snapshot: SecuritiesSnapshot,
) {
	const worker =
		registration.active ?? registration.waiting ?? registration.installing;
	worker?.postMessage({ type: "STORE_SECURITIES", ...snapshot });
}

function scheduleForegroundRefresh(
	registration: ServiceWorkerRegistration | null,
) {
	const delay = Math.max(
		0,
		getNextTaipeiRefreshAt(new Date(), 8).getTime() - Date.now(),
	);

	window.setTimeout(() => {
		void syncSecuritiesIfDue()
			.then((snapshot) => {
				if (snapshot && registration) {
					sendSnapshotToServiceWorker(registration, snapshot);
				}
			})
			.catch(() => undefined)
			.finally(() => scheduleForegroundRefresh(registration));
	}, delay);
}

export async function initializeSecuritiesSync() {
	let registration: ServiceWorkerRegistration | null = null;
	let registrationPromise = Promise.resolve<ServiceWorkerRegistration | null>(
		null,
	);

	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.addEventListener("message", (event) => {
			const message = event.data as SecuritiesUpdatedMessage;
			if (message?.type === "SECURITIES_UPDATED") {
				storeSecuritiesSnapshot(message);
			}
		});

		registrationPromise = getAppServiceWorkerRegistration();
	}

	let snapshot: SecuritiesSnapshot | null = null;
	try {
		snapshot = await syncSecuritiesIfDue();
	} catch {
		// The application shell remains usable while the API is unavailable.
	}

	registration = await registrationPromise;
	if (registration) {
		await registerDailyPeriodicSync(registration, SECURITIES_PERIODIC_SYNC_TAG);
		if (snapshot) {
			sendSnapshotToServiceWorker(registration, snapshot);
		} else {
			registration.active?.postMessage({
				type: "CHECK_SECURITIES_UPDATE",
			});
		}
	}

	const refreshWhenDue = () => {
		void syncSecuritiesIfDue()
			.then((newSnapshot) => {
				if (newSnapshot && registration) {
					sendSnapshotToServiceWorker(registration, newSnapshot);
				}
			})
			.catch(() => undefined);
	};

	window.addEventListener("online", refreshWhenDue);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") refreshWhenDue();
	});
	scheduleForegroundRefresh(registration);
}
