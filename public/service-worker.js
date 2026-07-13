const SECURITIES_API_URL = "/api/pub/securities";
const SECURITIES_CACHE = "futw-securities-v1";
const SECURITIES_CACHE_KEY = "/__futw/securities";
const SECURITIES_METADATA_KEY = "/__futw/securities-metadata";
const SECURITIES_PERIODIC_SYNC_TAG = "refresh-securities";
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

function getMostRecentTaipeiRefreshAt(now = new Date()) {
	const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET_MS);
	const refreshAt = Date.UTC(
		taipeiNow.getUTCFullYear(),
		taipeiNow.getUTCMonth(),
		taipeiNow.getUTCDate(),
		0,
	);

	return taipeiNow.getUTCHours() >= 8 ? refreshAt : refreshAt - ONE_DAY_MS;
}

async function storeSnapshot(securities, syncedAt) {
	const cache = await caches.open(SECURITIES_CACHE);
	await Promise.all([
		cache.put(
			SECURITIES_CACHE_KEY,
			new Response(JSON.stringify(securities), {
				headers: { "content-type": "application/json" },
			}),
		),
		cache.put(
			SECURITIES_METADATA_KEY,
			new Response(JSON.stringify({ syncedAt }), {
				headers: { "content-type": "application/json" },
			}),
		),
	]);
}

async function getLastSyncedAt() {
	const cache = await caches.open(SECURITIES_CACHE);
	const response = await cache.match(SECURITIES_METADATA_KEY);
	if (!response) return null;

	try {
		const metadata = await response.json();
		return metadata.syncedAt ?? null;
	} catch {
		return null;
	}
}

async function notifyClients(securities, syncedAt) {
	const clients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	for (const client of clients) {
		client.postMessage({
			type: "SECURITIES_UPDATED",
			securities,
			syncedAt,
		});
	}
}

async function downloadAndStoreSecurities() {
	const response = await fetch(SECURITIES_API_URL, {
		cache: "no-store",
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`Unable to download securities: ${response.status}`);
	}

	const securities = await response.json();
	const syncedAt = new Date().toISOString();
	await storeSnapshot(securities, syncedAt);
	await notifyClients(securities, syncedAt);
}

async function refreshSecuritiesIfDue() {
	const lastSyncedAt = await getLastSyncedAt();
	const lastSyncTime = lastSyncedAt ? Date.parse(lastSyncedAt) : Number.NaN;
	if (
		!Number.isNaN(lastSyncTime) &&
		lastSyncTime >= getMostRecentTaipeiRefreshAt()
	) {
		return;
	}

	await downloadAndStoreSecurities();
}

self.addEventListener("periodicsync", (event) => {
	if (event.tag === SECURITIES_PERIODIC_SYNC_TAG) {
		event.waitUntil(refreshSecuritiesIfDue());
	}
});

self.addEventListener("message", (event) => {
	if (event.data?.type === "STORE_SECURITIES") {
		event.waitUntil(
			storeSnapshot(event.data.securities, event.data.syncedAt),
		);
	}

	if (event.data?.type === "CHECK_SECURITIES_UPDATE") {
		event.waitUntil(refreshSecuritiesIfDue());
	}
});
