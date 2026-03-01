/**
 * Quick example (matches curl usage):
 *   await callDataApi("Youtube/search", {
 *     query: { gl: "US", hl: "en", q: "example" },
 *   })
 */
import { ENV } from "./env";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

/**
 * Data API stub.
 * External data APIs should be called directly with fetch() and your own API keys.
 */
export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  console.warn(`[DataApi] callDataApi("${apiId}") called — use direct API calls instead.`);
  console.warn(`[DataApi] Configure your API keys in Admin Panel → Integrations.`);
  throw new Error(
    `Data API "${apiId}" is not available. Use direct API calls instead.`
  );
}
