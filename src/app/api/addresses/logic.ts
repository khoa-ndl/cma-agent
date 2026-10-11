// GET /api/addresses (spec 5 screen 2): address autocomplete for the
// "New CMA" form, behind a session so the sample dataset isn't scraped
// by anyone without a code.
import type { DataProvider } from "@/lib/data/provider";

const MAX_RESULTS = 10;

export interface AddressesResult {
  status: number;
  body: unknown;
}

export async function handleAddressesRequest(
  provider: DataProvider,
  query: string,
  accessCodeId: string | null,
): Promise<AddressesResult> {
  if (!accessCodeId) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }
  if (query.trim().length === 0) {
    return { status: 200, body: { matches: [] } };
  }

  const matches = await provider.searchAddresses(query, MAX_RESULTS);
  return { status: 200, body: { matches } };
}
