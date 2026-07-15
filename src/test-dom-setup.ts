import { JSDOM } from "jsdom";

if (typeof globalThis.window === "undefined") {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "http://localhost/",
	});
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		localStorage: dom.window.localStorage,
		navigator: dom.window.navigator,
		HTMLElement: dom.window.HTMLElement,
		HTMLInputElement: dom.window.HTMLInputElement,
		Node: dom.window.Node,
		Event: dom.window.Event,
		CustomEvent: dom.window.CustomEvent,
		KeyboardEvent: dom.window.KeyboardEvent,
		MessageEvent: dom.window.MessageEvent,
		MouseEvent: dom.window.MouseEvent,
		MutationObserver: dom.window.MutationObserver,
		getComputedStyle: dom.window.getComputedStyle,
	});
}

const scrollTo = () => undefined;
Object.defineProperty(globalThis, "scrollTo", {
	configurable: true,
	value: scrollTo,
	writable: true,
});
Object.defineProperty(globalThis.window, "scrollTo", {
	configurable: true,
	value: scrollTo,
	writable: true,
});
globalThis.window.setTimeout =
	globalThis.setTimeout as typeof window.setTimeout;
globalThis.window.clearTimeout =
	globalThis.clearTimeout as typeof window.clearTimeout;

if (!globalThis.window.matchMedia) {
	Object.defineProperty(globalThis.window, "matchMedia", {
		configurable: true,
		value: () => ({
			matches: true,
			media: "(prefers-reduced-motion: reduce)",
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false,
		}),
	});
}

if (globalThis.window !== globalThis) {
	if (!globalThis.window.fetch)
		globalThis.window.fetch = globalThis.fetch.bind(globalThis);
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		get: () => globalThis.window.fetch,
		set: (value) => {
			globalThis.window.fetch = value;
		},
	});
}

Object.defineProperties(globalThis.window.HTMLElement.prototype, {
	attachEvent: { configurable: true, value: () => undefined },
	detachEvent: { configurable: true, value: () => undefined },
});
Object.defineProperties(globalThis.document, {
	oninput: { configurable: true, value: null, writable: true },
});
Object.defineProperties(globalThis.window, {
	oninput: { configurable: true, value: null, writable: true },
});
