export const MARKET_DATA_UPDATED_EVENT = "futw:market-data-updated";

export function notifyMarketDataUpdated(storage: Pick<Storage, "getItem">) {
	if (typeof window === "undefined" || storage !== window.localStorage) return;
	window.dispatchEvent(new Event(MARKET_DATA_UPDATED_EVENT));
}
