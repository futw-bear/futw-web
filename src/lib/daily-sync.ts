const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type PeriodicSyncManager = {
	getTags(): Promise<string[]>;
	register(tag: string, options: { minInterval: number }): Promise<void>;
};

type RegistrationWithPeriodicSync = ServiceWorkerRegistration & {
	periodicSync?: PeriodicSyncManager;
};

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
	null;

export function getMostRecentTaipeiRefreshAt(
	now = new Date(),
	refreshHour = 8,
) {
	const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET_MS);
	const refreshAt = Date.UTC(
		taipeiNow.getUTCFullYear(),
		taipeiNow.getUTCMonth(),
		taipeiNow.getUTCDate(),
		refreshHour - 8,
	);

	return new Date(
		taipeiNow.getUTCHours() >= refreshHour ? refreshAt : refreshAt - ONE_DAY_MS,
	);
}

export function getNextTaipeiRefreshAt(now = new Date(), refreshHour = 8) {
	const mostRecentRefreshAt = getMostRecentTaipeiRefreshAt(now, refreshHour);
	const nextRefreshAt = new Date(mostRecentRefreshAt.getTime() + ONE_DAY_MS);

	return nextRefreshAt.getTime() > now.getTime()
		? nextRefreshAt
		: new Date(nextRefreshAt.getTime() + ONE_DAY_MS);
}

export function isRefreshDue(
	lastSyncedAt: string | null,
	now = new Date(),
	refreshHour = 8,
) {
	if (!lastSyncedAt) return true;

	const lastSyncTime = Date.parse(lastSyncedAt);
	if (Number.isNaN(lastSyncTime)) return true;

	return (
		lastSyncTime < getMostRecentTaipeiRefreshAt(now, refreshHour).getTime()
	);
}

export function getAppServiceWorkerRegistration() {
	if (!("serviceWorker" in navigator)) return Promise.resolve(null);

	registrationPromise ??= navigator.serviceWorker
		.register("/service-worker.js")
		.then(async (registration) => {
			await navigator.serviceWorker.ready;
			return registration;
		})
		.catch(() => null);

	return registrationPromise;
}

export async function registerDailyPeriodicSync(
	registration: ServiceWorkerRegistration,
	tag: string,
) {
	const periodicSync = (registration as RegistrationWithPeriodicSync)
		.periodicSync;
	if (!periodicSync) return;

	try {
		const tags = await periodicSync.getTags();
		if (!tags.includes(tag)) {
			await periodicSync.register(tag, { minInterval: ONE_DAY_MS });
		}
	} catch {
		// Foreground refreshes remain available when background sync is denied.
	}
}
