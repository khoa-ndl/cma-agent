// The client-ready PDF (spec 5 screen 5, A7, A13): cover, subject, comps,
// adjustment grid, recommendation, rationale, methodology appendix, and
// disclosures on every page. Pure — no database or model access, no
// network — same engine-output-only rule as the UI (spec 4.1, A5): every
// figure here is read straight off CmaResult, nothing recomputed or
// restated by the model.
import path from "node:path";
import { Document, Page, View, Text, StyleSheet, Font, Svg, Circle, Rect, G, Image } from "@react-pdf/renderer";
import type { Subject } from "@/lib/engine/adjustments";
import type { CmaResult } from "@/lib/agent/tools";
import { getAdjustmentRates } from "@/lib/engine/config";
import { SAMPLE_DATA_DISCLOSURE, NOT_APPRAISAL_DISCLOSURE } from "@/lib/disclosures";
import {
  ADJUSTMENT_FACTORS,
  compactCurrency,
  currency,
  layoutCompMap,
  photoForListing,
  type CompMapLayout,
} from "@/lib/report-formatting";
import type { ReportBody } from "@/app/api/reports/[id]/logic";

// Task 1's bundled Outfit statics (react-pdf can't read the `--font-heading`
// CSS variable or load variable-font .ttf weights, so headings register two
// fixed weights by hand instead).
Font.register({
  family: "Outfit",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/Outfit-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(process.cwd(), "public/fonts/Outfit-ExtraBold.ttf"), fontWeight: 800 },
  ],
});

// Task 1's --color-primary (deep navy). react-pdf styles can't read CSS
// variables, so this is hardcoded here and must be kept in sync by eye with
// src/app/globals.css, same as the other hardcoded colors in this file.
const COLOR_PRIMARY = "#1e3a5f";
const COLOR_ACCENT = "#ea580c";
const COLOR_MUTED = "#d5dde9";

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
  coverTitle: { fontSize: 28, fontFamily: "Outfit", fontWeight: 800, marginBottom: 16 },
  coverSubject: { fontSize: 13, color: "#475569", lineHeight: 1.6 },
  h1: { fontSize: 16, fontFamily: "Outfit", fontWeight: "bold", marginBottom: 8, marginTop: 20 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  p: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4, alignItems: "center" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingVertical: 4 },
  headerCell: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#475569" },
  cell: { fontSize: 9 },
  recommendation: { borderWidth: 1, borderColor: "#e2e8f0", padding: 12, marginBottom: 12 },
  recommendationValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: COLOR_PRIMARY, marginBottom: 2 },
  subjectSection: {
    borderWidth: 1.5,
    borderColor: COLOR_PRIMARY,
    backgroundColor: "#f0f4f8",
    padding: 12,
    marginBottom: 12,
  },
  subjectLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR_PRIMARY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  subjectAddress: { fontSize: 15, fontFamily: "Outfit", fontWeight: "bold", marginBottom: 4 },
  subjectFacts: { fontSize: 10, color: "#475569" },
  mapSection: { marginBottom: 12, alignItems: "center" },
  mapCaption: { fontSize: 8, color: "#475569", marginTop: 4, textAlign: "center" },
  mapPinLabel: { fontSize: 7, fill: "#1e293b", textAnchor: "middle" },
  photoCell: { width: "16%", paddingRight: 6 },
  photoThumbnail: { width: 64, height: 48, borderRadius: 4, objectFit: "cover" },
  photoCaption: { fontSize: 6.5, color: "#475569", marginTop: 2 },
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

// The stored subject JSON blob carries unparsedAddress when address
// autocomplete supplied one, same fallback-to-area reasoning the web
// results page (ReportView) uses for the same field -- it's not part of
// the Subject TS interface itself.
type SubjectWithAddress = Subject & { unparsedAddress?: string };

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

function SubjectSection({ subject }: { subject: SubjectWithAddress }) {
  return (
    <View style={styles.subjectSection}>
      <Text style={styles.subjectLabel}>Subject Property</Text>
      <Text style={styles.subjectAddress}>{subject.unparsedAddress ?? subject.mlsAreaMajor}</Text>
      <Text style={styles.subjectFacts}>
        {subject.mlsAreaMajor} · {subject.propertySubType} · {subject.bedroomsTotal} bed /{" "}
        {subject.bathroomsTotalInteger} bath · {subject.livingArea.toLocaleString()} sq ft
      </Text>
    </View>
  );
}

// Only rendered when mapPositions was supplied (Task 4) -- an old report
// re-rendered, or one whose source listing/comp lookups came back empty,
// has no coordinates to plot, so the report simply omits this section
// rather than throwing or showing a broken map.
function CompMap({ layout, result }: { layout: CompMapLayout; result: CmaResult }) {
  return (
    <View style={styles.mapSection}>
      <Text style={styles.h1}>Comp Map</Text>
      <Svg width={200} height={200} viewBox={`0 0 ${layout.viewBoxSize} ${layout.viewBoxSize}`}>
        <Rect x={0} y={0} width={layout.viewBoxSize} height={layout.viewBoxSize} rx={8} fill={COLOR_MUTED} />
        {layout.pins.map((pin) => {
          const comp = result.selectedComps.find((c) => c.listingKey === pin.listingKey);
          return (
            <G key={pin.listingKey}>
              <Circle cx={pin.x} cy={pin.y} r={6} fill={COLOR_ACCENT} />
              {comp && (
                <Text x={pin.x} y={pin.y + 14} style={styles.mapPinLabel}>
                  {compactCurrency(comp.adjustedValue)}
                </Text>
              )}
            </G>
          );
        })}
        <Circle cx={layout.subject.x} cy={layout.subject.y} r={8} fill={COLOR_PRIMARY} />
      </Svg>
      <Text style={styles.mapCaption}>
        Subject property (navy) and comparable sales (orange) by approximate location
      </Text>
    </View>
  );
}

function ComparablesTable({ result, subject }: { result: CmaResult; subject: Subject }) {
  return (
    <View>
      <Text style={styles.h1}>Comparable Sales</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "16%" }]}>Photo</Text>
        <Text style={[styles.headerCell, { width: "24%" }]}>Address</Text>
        <Text style={[styles.headerCell, { width: "12%" }]}>Weight</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Base price</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Adjustment</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Adjusted value</Text>
      </View>
      {result.selectedComps.map((comp) => (
        <View key={comp.listingKey} style={styles.row} wrap={false}>
          <View style={styles.photoCell}>
            {/* react-pdf's Image has no `alt` prop -- it isn't an HTML <img>,
                just named the same; the "Representative image" <Text> below
                is this row's caption. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              style={styles.photoThumbnail}
              src={path.join(process.cwd(), "public", photoForListing(comp.listingKey, subject.propertySubType))}
            />
            <Text style={styles.photoCaption}>Representative image</Text>
          </View>
          <Text style={[styles.cell, { width: "24%" }]}>{comp.unparsedAddress}</Text>
          <Text style={[styles.cell, { width: "12%" }]}>{comp.weight}</Text>
          <Text style={[styles.cell, { width: "16%" }]}>{currency(comp.basePrice)}</Text>
          <Text style={[styles.cell, { width: "16%" }]}>{currency(comp.totalAdjustment)}</Text>
          <Text style={[styles.cell, { width: "16%" }]}>{currency(comp.adjustedValue)}</Text>
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

export function ReportDocument({
  subject,
  result,
  mapPositions,
}: {
  subject: SubjectWithAddress;
  result: CmaResult;
  mapPositions?: ReportBody["mapPositions"];
}) {
  // mapPositions.subject can be null (no sourceListingKey, or the lookup
  // came back empty) -- fall back to the subject's own lat/long, same
  // reasoning ReportView uses for the web rendering of the same map.
  const compMapLayout = mapPositions
    ? layoutCompMap(mapPositions.subject ?? subject, mapPositions.comps)
    : null;

  return (
    <Document title="CMA Agent Report">
      <CoverPage subject={subject} />
      <Page size="A4" style={styles.page}>
        <SubjectSection subject={subject} />
        {compMapLayout && <CompMap layout={compMapLayout} result={result} />}
        <ComparablesTable result={result} subject={subject} />
        <AdjustmentGrid result={result} />
        <Recommendation result={result} />
        <RationaleSection result={result} />
        <MethodologyAppendix subject={subject} />
        <Disclosures />
      </Page>
    </Document>
  );
}
