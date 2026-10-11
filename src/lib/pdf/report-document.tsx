// The client-ready PDF (spec 5 screen 5, A7, A13): cover, subject, comps,
// adjustment grid, recommendation, rationale, methodology appendix, and
// disclosures on every page. Pure — no database or model access, no
// network — same engine-output-only rule as the UI (spec 4.1, A5): every
// figure here is read straight off CmaResult, nothing recomputed or
// restated by the model.
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Subject } from "@/lib/engine/adjustments";
import type { CmaResult } from "@/lib/agent/tools";
import { getAdjustmentRates } from "@/lib/engine/config";
import { SAMPLE_DATA_DISCLOSURE, NOT_APPRAISAL_DISCLOSURE } from "@/lib/disclosures";
import { ADJUSTMENT_FACTORS, currency } from "@/lib/report-formatting";

const RATE_ROWS: Array<[keyof ReturnType<typeof getAdjustmentRates>, string, (n: number) => string]> = [
  ["livingAreaPerSqft", "Living area", (n) => `${currency(n)} / sq ft`],
  ["bedroom", "Bedroom", (n) => currency(n)],
  ["bathroom", "Bathroom", (n) => currency(n)],
  ["garageSpace", "Garage space", (n) => currency(n)],
  ["lotSizePerSqft", "Lot size", (n) => `${currency(n)} / sq ft`],
  ["agePerDecade", "Age", (n) => `${currency(n)} / decade`],
  ["conditionStep", "Condition step", (n) => currency(n)],
  ["marketTimePerMonth", "Market time", (n) => `${(n * 100).toFixed(2)}% / month`],
];

const styles = StyleSheet.create({
  page: { padding: 48, paddingBottom: 72, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  coverPage: {
    padding: 48,
    paddingBottom: 72,
    fontFamily: "Helvetica",
    color: "#1e293b",
    justifyContent: "center",
  },
  coverLabel: { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  coverTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", marginBottom: 16 },
  coverSubject: { fontSize: 13, color: "#475569", lineHeight: 1.6 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 20 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  p: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingVertical: 4 },
  headerCell: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#475569" },
  cell: { fontSize: 9 },
  recommendation: { borderWidth: 1, borderColor: "#e2e8f0", padding: 12, marginBottom: 12 },
  recommendationValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#2563eb", marginBottom: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: "#475569",
  },
});

function Disclosures() {
  return (
    <View style={styles.footer} fixed>
      <Text>{SAMPLE_DATA_DISCLOSURE}</Text>
      <Text>{NOT_APPRAISAL_DISCLOSURE}</Text>
    </View>
  );
}

function CoverPage({ subject }: { subject: Subject }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.coverLabel}>Comparative Market Analysis</Text>
      <Text style={styles.coverTitle}>CMA Agent Report</Text>
      <Text style={styles.coverSubject}>
        {subject.mlsAreaMajor} · {subject.propertySubType}
        {"\n"}
        {subject.bedroomsTotal} bed / {subject.bathroomsTotalInteger} bath · {subject.livingArea.toLocaleString()} sq
        ft · built {subject.yearBuilt}
        {"\n"}
        Condition: {subject.propertyCondition}
      </Text>
      <Disclosures />
    </Page>
  );
}

function ComparablesTable({ result }: { result: CmaResult }) {
  return (
    <View>
      <Text style={styles.h1}>Comparable Sales</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "40%" }]}>Address</Text>
        <Text style={[styles.headerCell, { width: "15%" }]}>Weight</Text>
        <Text style={[styles.headerCell, { width: "15%" }]}>Base price</Text>
        <Text style={[styles.headerCell, { width: "15%" }]}>Adjustment</Text>
        <Text style={[styles.headerCell, { width: "15%" }]}>Adjusted value</Text>
      </View>
      {result.selectedComps.map((comp) => (
        <View key={comp.listingKey} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: "40%" }]}>{comp.unparsedAddress}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{comp.weight}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{currency(comp.basePrice)}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{currency(comp.totalAdjustment)}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{currency(comp.adjustedValue)}</Text>
        </View>
      ))}
    </View>
  );
}

function AdjustmentGrid({ result }: { result: CmaResult }) {
  return (
    <View>
      <Text style={styles.h1}>Adjustment Grid</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "24%" }]}>Address</Text>
        {ADJUSTMENT_FACTORS.map(([factor, label]) => (
          <Text key={factor} style={[styles.headerCell, { width: `${76 / ADJUSTMENT_FACTORS.length}%` }]}>
            {label}
          </Text>
        ))}
      </View>
      {result.selectedComps.map((comp) => {
        const byFactor = Object.fromEntries(comp.adjustments.map((item) => [item.factor, item.amount]));
        return (
          <View key={comp.listingKey} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: "24%" }]}>{comp.unparsedAddress}</Text>
            {ADJUSTMENT_FACTORS.map(([factor]) => (
              <Text key={factor} style={[styles.cell, { width: `${76 / ADJUSTMENT_FACTORS.length}%` }]}>
                {byFactor[factor] ? currency(byFactor[factor]) : "—"}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Recommendation({ result }: { result: CmaResult }) {
  return (
    <View>
      <Text style={styles.h1}>Pricing Recommendation</Text>
      <View style={styles.recommendation}>
        <Text style={styles.recommendationValue}>
          {currency(result.valueRange.low)} – {currency(result.valueRange.high)}
        </Text>
        <Text style={styles.p}>Suggested list price: {currency(result.valueRange.suggestedListPrice)}</Text>
      </View>
    </View>
  );
}

function RationaleSection({ result }: { result: CmaResult }) {
  return (
    <View>
      <Text style={styles.h1}>Rationale</Text>
      <Text style={styles.p}>{result.rationale}</Text>
      {result.excludedComps.length > 0 && (
        <View>
          <Text style={styles.h2}>Excluded Comparables</Text>
          {result.excludedComps.map((comp) => (
            <Text key={comp.listingKey} style={styles.p}>
              {comp.listingKey}: {comp.reason}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function MethodologyAppendix({ subject }: { subject: Subject }) {
  const rates = getAdjustmentRates(subject.mlsAreaMajor);
  return (
    <View break>
      <Text style={styles.h1}>Methodology Appendix</Text>
      <Text style={styles.p}>
        Adjustment rates for {subject.mlsAreaMajor}, applied per unit of difference between the subject and each
        comparable. A positive line item means the subject exceeds the comparable on that factor.
      </Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "50%" }]}>Factor</Text>
        <Text style={[styles.headerCell, { width: "50%" }]}>Rate</Text>
      </View>
      {RATE_ROWS.map(([key, label, format]) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.cell, { width: "50%" }]}>{label}</Text>
          <Text style={[styles.cell, { width: "50%" }]}>{format(rates[key])}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ subject, result }: { subject: Subject; result: CmaResult }) {
  return (
    <Document title="CMA Agent Report">
      <CoverPage subject={subject} />
      <Page size="A4" style={styles.page}>
        <ComparablesTable result={result} />
        <AdjustmentGrid result={result} />
        <Recommendation result={result} />
        <RationaleSection result={result} />
        <MethodologyAppendix subject={subject} />
        <Disclosures />
      </Page>
    </Document>
  );
}
