import {
	getAppServiceWorkerRegistration,
	getNextTaipeiRefreshAt,
	isRefreshDue,
	registerDailyPeriodicSync,
} from "./daily-sync";
import { notifyMarketDataUpdated } from "./storage-events";

export const PRICE_MARKETS = ["TSE", "OTC"] as const;
export type PriceMarket = (typeof PRICE_MARKETS)[number];

export const PRICES_SYNCED_AT_KEY = "prices:last-synced-at";
export const PRICES_PERIODIC_SYNC_TAG = "refresh-prices";
export const PRICES_REFRESH_HOUR = 10;

type Fetcher = typeof fetch;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

type PricesUpdatedMessage = {
	type: "PRICES_UPDATED";
	prices: Record<PriceMarket, unknown>;
	syncedAt: string;
};

export type PricesSnapshot = {
	prices: Record<PriceMarket, unknown>;
	syncedAt: string;
};

export function getPricesStorageKey(market: PriceMarket) {
	return `prices:${market}`;
}

export function isPricesRefreshDue(
	lastSyncedAt: string | null,
	now = new Date(),
) {
	return isRefreshDue(lastSyncedAt, now, PRICES_REFRESH_HOUR);
}

export function storePricesSnapshot(
	snapshot: PricesSnapshot,
	storage: StorageLike = window.localStorage,
) {
	for (const market of PRICE_MARKETS) {
		storage.setItem(
			getPricesStorageKey(market),
			JSON.stringify(snapshot.prices[market]),
		);
	}
	storage.setItem(PRICES_SYNCED_AT_KEY, snapshot.syncedAt);
	notifyMarketDataUpdated(storage);
}

export async function downloadPrices(
	fetcher: Fetcher = fetch,
	now = new Date(),
): Promise<PricesSnapshot> {
	const marketPrices = await Promise.all(
		PRICE_MARKETS.map(async (market) => {
			const response = await fetcher(
				`/api/pub/prices?market=${encodeURIComponent(market)}`,
				{
					cache: "no-store",
					headers: { accept: "application/json" },
				},
			);

			if (!response.ok) {
				throw new Error(
					`Unable to download ${market} prices: ${response.status}`,
				);
			}

			return [market, await response.json()] as const;
		}),
	);

	return {
		prices: Object.fromEntries(marketPrices) as Record<PriceMarket, unknown>,
		syncedAt: now.toISOString(),
	};
}

export async function syncPricesIfDue({
	now = new Date(),
	storage = window.localStorage,
	fetcher = fetch,
}: {
	now?: Date;
	storage?: StorageLike;
	fetcher?: Fetcher;
} = {}) {
	const hasAllPrices = PRICE_MARKETS.every(
		(market) => storage.getItem(getPricesStorageKey(market)) !== null,
	);
	const lastSyncedAt = storage.getItem(PRICES_SYNCED_AT_KEY);

	if (hasAllPrices && !isPricesRefreshDue(lastSyncedAt, now)) return null;

	const snapshot = await downloadPrices(fetcher, now);
	storePricesSnapshot(snapshot, storage);
	return snapshot;
}

function sendSnapshotToServiceWorker(
	registration: ServiceWorkerRegistration,
	snapshot: PricesSnapshot,
) {
	const worker =
		registration.active ?? registration.waiting ?? registration.installing;
	worker?.postMessage({ type: "STORE_PRICES", ...snapshot });
}

function scheduleForegroundRefresh(
	registration: ServiceWorkerRegistration | null,
) {
	const delay = Math.max(
		0,
		getNextTaipeiRefreshAt(new Date(), PRICES_REFRESH_HOUR).getTime() -
			Date.now(),
	);

	window.setTimeout(() => {
		void syncPricesIfDue()
			.then((snapshot) => {
				if (snapshot && registration) {
					sendSnapshotToServiceWorker(registration, snapshot);
				}
			})
			.catch(() => undefined)
			.finally(() => scheduleForegroundRefresh(registration));
	}, delay);
}

export async function initializePricesSync() {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.addEventListener("message", (event) => {
			const message = event.data as PricesUpdatedMessage;
			if (message?.type === "PRICES_UPDATED") {
				storePricesSnapshot(message);
			}
		});
	}

	const registrationPromise = getAppServiceWorkerRegistration();
	let snapshot: PricesSnapshot | null = null;

	try {
		snapshot = await syncPricesIfDue();
	} catch {
		// Existing prices remain available while the API is unavailable.
	}

	const registration = await registrationPromise;
	if (registration) {
		await registerDailyPeriodicSync(registration, PRICES_PERIODIC_SYNC_TAG);

		if (snapshot) {
			sendSnapshotToServiceWorker(registration, snapshot);
		} else {
			registration.active?.postMessage({ type: "CHECK_PRICES_UPDATE" });
		}
	}

	const refreshWhenDue = () => {
		void syncPricesIfDue()
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
