const SECURITIES_API_URLS = [
	"/api/pub/securities?type=2",
	"/api/pub/securities?type=4",
];
const SECURITIES_CACHE = "futw-securities-v1";
const SECURITIES_CACHE_KEY = "/__futw/securities";
const SECURITIES_METADATA_KEY = "/__futw/securities-metadata";
const SECURITIES_PERIODIC_SYNC_TAG = "refresh-securities";
const PRICE_MARKETS = ["TSE", "OTC"];
const PRICES_CACHE = "futw-prices-v1";
const PRICES_CACHE_KEY = "/__futw/prices";
const PRICES_METADATA_KEY = "/__futw/prices-metadata";
const PRICES_PERIODIC_SYNC_TAG = "refresh-prices";
const PRICES_REFRESH_HOUR = 10;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

function getMostRecentTaipeiRefreshAt(now = new Date(), refreshHour = 8) {
	const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET_MS);
	const refreshAt = Date.UTC(
		taipeiNow.getUTCFullYear(),
		taipeiNow.getUTCMonth(),
		taipeiNow.getUTCDate(),
		refreshHour - 8,
	);

	return taipeiNow.getUTCHours() >= refreshHour
		? refreshAt
		: refreshAt - ONE_DAY_MS;
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

async function getLastSyncedAt(cacheName, metadataKey) {
	const cache = await caches.open(cacheName);
	const response = await cache.match(metadataKey);
	if (!response) return null;

	try {
		const metadata = await response.json();
		return metadata.syncedAt ?? null;
	} catch {
		return null;
	}
}

async function notifyClients(message) {
	const clients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	for (const client of clients) {
		client.postMessage(message);
	}
}

async function downloadAndStoreSecurities() {
	const securities = await Promise.all(
		SECURITIES_API_URLS.map(async (url) => {
			const response = await fetch(url, {
				cache: "no-store",
				headers: { accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error(`Unable to download securities: ${response.status}`);
			}
			const payload = await response.json();
			return Array.isArray(payload) ? payload : [];
		}),
	);
	const syncedAt = new Date().toISOString();
	const mergedSecurities = securities.flat();
	await storeSnapshot(mergedSecurities, syncedAt);
	await notifyClients({
		type: "SECURITIES_UPDATED",
		securities: mergedSecurities,
		syncedAt,
	});
}

async function refreshSecuritiesIfDue() {
	const lastSyncedAt = await getLastSyncedAt(
		SECURITIES_CACHE,
		SECURITIES_METADATA_KEY,
	);
	const lastSyncTime = lastSyncedAt ? Date.parse(lastSyncedAt) : Number.NaN;
	if (
		!Number.isNaN(lastSyncTime) &&
		lastSyncTime >= getMostRecentTaipeiRefreshAt(new Date(), 8)
	) {
		return;
	}

	await downloadAndStoreSecurities();
}

async function storePricesSnapshot(prices, syncedAt) {
	const cache = await caches.open(PRICES_CACHE);
	await Promise.all([
		cache.put(
			PRICES_CACHE_KEY,
			new Response(JSON.stringify(prices), {
				headers: { "content-type": "application/json" },
			}),
		),
		cache.put(
			PRICES_METADATA_KEY,
			new Response(JSON.stringify({ syncedAt }), {
				headers: { "content-type": "application/json" },
			}),
		),
	]);
}

async function downloadAndStorePrices() {
	const marketPrices = await Promise.all(
		PRICE_MARKETS.map(async (market) => {
			const response = await fetch(
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

			return [market, await response.json()];
		}),
	);

	const prices = Object.fromEntries(marketPrices);
	const syncedAt = new Date().toISOString();
	await storePricesSnapshot(prices, syncedAt);
	await notifyClients({ type: "PRICES_UPDATED", prices, syncedAt });
}

async function refreshPricesIfDue() {
	const lastSyncedAt = await getLastSyncedAt(
		PRICES_CACHE,
		PRICES_METADATA_KEY,
	);
	const lastSyncTime = lastSyncedAt ? Date.parse(lastSyncedAt) : Number.NaN;
	if (
		!Number.isNaN(lastSyncTime) &&
		lastSyncTime >=
			getMostRecentTaipeiRefreshAt(new Date(), PRICES_REFRESH_HOUR)
	) {
		return;
	}

	await downloadAndStorePrices();
}

self.addEventListener("periodicsync", (event) => {
	if (event.tag === SECURITIES_PERIODIC_SYNC_TAG) {
		event.waitUntil(refreshSecuritiesIfDue());
	}

	if (event.tag === PRICES_PERIODIC_SYNC_TAG) {
		event.waitUntil(refreshPricesIfDue());
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

	if (event.data?.type === "STORE_PRICES") {
		event.waitUntil(
			storePricesSnapshot(event.data.prices, event.data.syncedAt),
		);
	}

	if (event.data?.type === "CHECK_PRICES_UPDATE") {
		event.waitUntil(refreshPricesIfDue());
	}
});
