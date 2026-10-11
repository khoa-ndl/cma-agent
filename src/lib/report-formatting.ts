// Shared between the web results page and the PDF (spec 5 screens 3–4
// and 5) so a label or the currency format can't drift between the two
// renderings of the same report.
export const ADJUSTMENT_FACTORS: Array<[string, string]> = [
  ["livingArea", "Living area"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["garageSpaces", "Garage"],
  ["lotSize", "Lot size"],
  ["age", "Age"],
  ["condition", "Condition"],
  ["marketTime", "Market time"],
];

export function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
