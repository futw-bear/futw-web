import { describe, expect, it } from "vitest";

import { getStoredSecurities, searchSecurities } from "./security-search";

function createMemoryStorage(value: string | null) {
	return { getItem: () => value };
}

describe("security search", () => {
	it("matches partial ticker and name queries from stored securities", () => {
		const storage = createMemoryStorage(
			JSON.stringify({
				data: [
					{ Code: "6233", Name: "旺玖" },
					{ Code: "2330", Name: "台積電" },
					{ Code: "2454", Name: "聯發科" },
				],
			}),
		);
		const securities = getStoredSecurities(storage);

		expect(
			searchSecurities(securities, "233").map(({ ticker }) => ticker),
		).toEqual(["6233", "2330"]);
		expect(searchSecurities(securities, "積電")).toEqual([
			{ ticker: "2330", name: "台積電" },
		]);
		expect(securities).toEqual([
			{ ticker: "6233", name: "旺玖" },
			{ ticker: "2330", name: "台積電" },
			{ ticker: "2454", name: "聯發科" },
		]);
	});
});
