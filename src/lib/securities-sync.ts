const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const SECURITIES_API_URL = "/api/pub/securities";
export const SECURITIES_STORAGE_KEY = "securities";
export const SECURITIES_SYNCED_AT_KEY = "securities:last-synced-at";
export const SECURITIES_PERIODIC_SYNC_TAG = "refresh-securities";

type Fetcher = typeof fetch;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

type PeriodicSyncManager = {
	getTags(): Promise<string[]>;
	register(tag: string, options: { minInterval: number }): Promise<void>;
};

type RegistrationWithPeriodicSync = ServiceWorkerRegistration & {
	periodicSync?: PeriodicSyncManager;
};

type SecuritiesUpdatedMessage = {
	type: "SECURITIES_UPDATED";
	securities: unknown;
	syncedAt: string;
};

export type SecuritiesSnapshot = {
	securities: unknown;
	syncedAt: string;
};

export function getMostRecentTaipeiRefreshAt(now = new Date()) {
	const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET_MS);
	const refreshAt = Date.UTC(
		taipeiNow.getUTCFullYear(),
		taipeiNow.getUTCMonth(),
		taipeiNow.getUTCDate(),
		0,
	);

	return new Date(
		taipeiNow.getUTCHours() >= 8 ? refreshAt : refreshAt - ONE_DAY_MS,
	);
}

export function getNextTaipeiRefreshAt(now = new Date()) {
	const mostRecentRefreshAt = getMostRecentTaipeiRefreshAt(now);
	const nextRefreshAt = new Date(mostRecentRefreshAt.getTime() + ONE_DAY_MS);

	return nextRefreshAt.getTime() > now.getTime()
		? nextRefreshAt
		: new Date(nextRefreshAt.getTime() + ONE_DAY_MS);
}

export function isSecuritiesRefreshDue(
	lastSyncedAt: string | null,
	now = new Date(),
) {
	if (!lastSyncedAt) return true;

	const lastSyncTime = Date.parse(lastSyncedAt);
	if (Number.isNaN(lastSyncTime)) return true;

	return lastSyncTime < getMostRecentTaipeiRefreshAt(now).getTime();
}

export function storeSecuritiesSnapshot(
	snapshot: SecuritiesSnapshot,
	storage: StorageLike = window.localStorage,
) {
	storage.setItem(SECURITIES_STORAGE_KEY, JSON.stringify(snapshot.securities));
	storage.setItem(SECURITIES_SYNCED_AT_KEY, snapshot.syncedAt);
}

export async function downloadSecurities(
	fetcher: Fetcher = fetch,
	now = new Date(),
): Promise<SecuritiesSnapshot> {
	const response = await fetcher(SECURITIES_API_URL, {
		cache: "no-store",
		headers: { accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Unable to download securities: ${response.status}`);
	}

	return {
		securities: await response.json(),
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

async function registerPeriodicSync(registration: ServiceWorkerRegistration) {
	const periodicSync = (registration as RegistrationWithPeriodicSync)
		.periodicSync;
	if (!periodicSync) return;

	try {
		const tags = await periodicSync.getTags();
		if (!tags.includes(SECURITIES_PERIODIC_SYNC_TAG)) {
			await periodicSync.register(SECURITIES_PERIODIC_SYNC_TAG, {
				minInterval: ONE_DAY_MS,
			});
		}
	} catch {
		// Foreground refreshes remain available when background sync is denied.
	}
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
	const delay = Math.max(0, getNextTaipeiRefreshAt().getTime() - Date.now());

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
	let registrationPromise: Promise<ServiceWorkerRegistration | null> =
		Promise.resolve(null);

	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.addEventListener("message", (event) => {
			const message = event.data as SecuritiesUpdatedMessage;
			if (message?.type === "SECURITIES_UPDATED") {
				storeSecuritiesSnapshot(message);
			}
		});

		registrationPromise = navigator.serviceWorker
			.register("/service-worker.js")
			.then(async (serviceWorkerRegistration) => {
				await navigator.serviceWorker.ready;
				await registerPeriodicSync(serviceWorkerRegistration);
				return serviceWorkerRegistration;
			})
			.catch(() => null);
	}

	let snapshot: SecuritiesSnapshot | null = null;
	try {
		snapshot = await syncSecuritiesIfDue();
	} catch {
		// The application shell remains usable while the API is unavailable.
	}

	registration = await registrationPromise;
	if (registration) {
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
