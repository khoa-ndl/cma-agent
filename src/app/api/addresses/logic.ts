// GET /api/addresses (spec 5 screen 2): address autocomplete for the
// "New CMA" form, behind a session so the sample dataset isn't scraped
// by anyone without a code. Shared by both the end-user and admin "New
// CMA" screens (operator-dashboard spec.md), so this only cares that
// *someone* is signed in -- which kind of session is route.ts's call.
import type { DataProvider } from "@/lib/data/provider";

const MAX_RESULTS = 10;

export interface AddressesResult {
  status: number;
  body: unknown;
}

export async function handleAddressesRequest(
  provider: DataProvider,
  query: string,
  authenticated: boolean,
): Promise<AddressesResult> {
  if (!authenticated) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }
  if (query.trim().length === 0) {
    return { status: 200, body: { matches: [] } };
  }

  const matches = await provider.searchAddresses(query, MAX_RESULTS);
  return { status: 200, body: { matches } };
}
