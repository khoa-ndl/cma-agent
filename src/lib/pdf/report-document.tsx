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
  humanizeEnum,
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

// Body text/weight range -- bundled the same way as Outfit above, since
// react-pdf can't read a Google Fonts <link> any more than it can read CSS
// variables. Previously this file left body text on react-pdf's built-in
// Helvetica, which isn't the product's own body font at all; every other
// brand surface (web, Outfit headings here) already uses Plus Jakarta Sans.
// Resolved from process.cwd() for the same Turbopack/__dirname reason as
// the comment on FONT_DIR below used to say about Outfit.
const FONT_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
Font.register({
  family: "Plus Jakarta Sans",
  fonts: [
    { src: path.join(FONT_DIR, "PlusJakartaSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "PlusJakartaSans-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "PlusJakartaSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "PlusJakartaSans-Bold.ttf"), fontWeight: 700 },
  ],
});

// Task 1's --color-primary (deep navy). react-pdf styles can't read CSS
// variables, so this is hardcoded here and must be kept in sync by eye with
// src/app/globals.css, same as the other hardcoded colors in this file.
const COLOR_PRIMARY = "#1e3a5f";
const COLOR_ACCENT = "#ea580c";
const COLOR_MUTED = "#d5dde9";
const COLOR_PRIMARY_MUTED = "#c3cedb";
const COLOR_FOREGROUND = "#1e293b";
const COLOR_MUTED_FOREGROUND = "#475569";
const COLOR_BORDER = "#e2e8f0";
const COLOR_STRIPE = "#f8fafc";
const COLOR_ON_PRIMARY = "#ffffff";

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
  page: { padding: 48, paddingBottom: 72, fontSize: 10, fontFamily: "Plus Jakarta Sans", color: COLOR_FOREGROUND },
  coverPage: { padding: 0, paddingBottom: 72, fontFamily: "Plus Jakarta Sans", color: COLOR_FOREGROUND },
  coverBand: { backgroundColor: COLOR_PRIMARY, paddingHorizontal: 48, paddingVertical: 40 },
  coverLabel: {
    fontSize: 11,
    color: COLOR_PRIMARY_MUTED,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 10,
    fontWeight: 600,
  },
  coverTitle: { fontSize: 28, fontFamily: "Outfit", fontWeight: 800, color: COLOR_ON_PRIMARY, marginBottom: 10 },
  coverAccentRule: { height: 4, width: 64, backgroundColor: COLOR_ACCENT },
  coverBody: { padding: 48, paddingTop: 32 },
  coverSubject: { fontSize: 13, color: COLOR_MUTED_FOREGROUND, lineHeight: 1.7 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 8 },
  sectionHeaderBar: { width: 4, height: 14, backgroundColor: COLOR_ACCENT, marginRight: 8 },
  h1: { fontSize: 16, fontFamily: "Outfit", fontWeight: "bold" },
  h2: { fontSize: 12, fontWeight: 600, marginBottom: 6 },
  p: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
    paddingVertical: 4,
    alignItems: "center",
  },
  rowAlt: { backgroundColor: COLOR_STRIPE },
  headerRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: COLOR_FOREGROUND, paddingVertical: 4 },
  headerCell: {
    fontWeight: 600,
    fontSize: 9,
    color: COLOR_MUTED_FOREGROUND,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cell: { fontSize: 9 },
  recommendation: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderLeftWidth: 4,
    borderLeftColor: COLOR_ACCENT,
    backgroundColor: COLOR_MUTED,
    padding: 12,
    marginBottom: 12,
  },
  recommendationValue: { fontSize: 18, fontWeight: 700, color: COLOR_PRIMARY, marginBottom: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  statTile: { width: "33.33%", padding: 6 },
  statTileInner: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderLeftWidth: 3,
    borderLeftColor: COLOR_PRIMARY,
    padding: 10,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: COLOR_MUTED_FOREGROUND,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { fontSize: 12, fontWeight: 700, color: COLOR_FOREGROUND },
  subjectAddress: { fontSize: 15, fontFamily: "Outfit", fontWeight: "bold", marginBottom: 8 },
  mapSection: { marginBottom: 12, alignItems: "center" },
  mapCaption: { fontSize: 8, color: COLOR_MUTED_FOREGROUND, marginTop: 4, textAlign: "center" },
  mapPinLabel: { fontSize: 7, fill: COLOR_FOREGROUND, textAnchor: "middle" },
  photoCell: { width: "16%", paddingRight: 6 },
  photoThumbnail: { width: 64, height: 48, borderRadius: 4, objectFit: "cover" },
  photoCaption: { fontSize: 6.5, color: COLOR_MUTED_FOREGROUND, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: COLOR_MUTED_FOREGROUND,
  },
  footerPage: { position: "absolute", bottom: 24, right: 48, fontSize: 8, color: COLOR_MUTED_FOREGROUND },
});

function Disclosures() {
  return (
    <>
      <View style={styles.footer} fixed>
        <Text>{SAMPLE_DATA_DISCLOSURE}</Text>
        <Text>{NOT_APPRAISAL_DISCLOSURE}</Text>
      </View>
      <Text style={styles.footerPage} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderBar} />
      <Text style={styles.h1}>{children}</Text>
    </View>
  );
}

// The stored subject JSON blob carries unparsedAddress when address
// autocomplete supplied one, same fallback-to-area reasoning the web
// results page (ReportView) uses for the same field -- it's not part of
// the Subject TS interface itself.
type SubjectWithAddress = Subject & { unparsedAddress?: string };

function CoverPage({ subject }: { subject: SubjectWithAddress }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverBand}>
        <Text style={styles.coverLabel}>Comparative Market Analysis</Text>
        <Text style={styles.coverTitle}>CMA Agent Report</Text>
        <View style={styles.coverAccentRule} />
      </View>
      <View style={styles.coverBody}>
        <Text style={styles.coverSubject}>
          {subject.unparsedAddress ?? subject.mlsAreaMajor}
          {"\n"}
          {humanizeEnum(subject.propertySubType)} · {subject.bedroomsTotal} bed / {subject.bathroomsTotalInteger} bath
          {"\n"}
          {subject.livingArea.toLocaleString()} sq ft · built {subject.yearBuilt} · {subject.propertyCondition}{" "}
          condition
        </Text>
      </View>
      <Disclosures />
    </Page>
  );
}

// Every fact the engine measures the subject against (spec 4.2) -- not just
// the handful that fit a one-line summary, since this is the one property
// a reader of the report will actually recognize on sight.
function SubjectSection({ subject }: { subject: SubjectWithAddress }) {
  const tiles: Array<[string, string]> = [
    ["Address", subject.unparsedAddress ?? "Address not on file"],
    ["Neighborhood / Area", subject.mlsAreaMajor],
    ["Property Type", humanizeEnum(subject.propertySubType)],
    ["Bedrooms", String(subject.bedroomsTotal)],
    ["Bathrooms", String(subject.bathroomsTotalInteger)],
    ["Living Area", `${subject.livingArea.toLocaleString()} sq ft`],
    ["Lot Size", subject.lotSizeSquareFeet ? `${subject.lotSizeSquareFeet.toLocaleString()} sq ft` : "Not on file"],
    ["Year Built", String(subject.yearBuilt)],
    ["Garage Spaces", String(subject.garageSpaces)],
    ["Condition", subject.propertyCondition],
  ];
  return (
    <View>
      <SectionHeader>Subject Property</SectionHeader>
      <Text style={styles.subjectAddress}>{subject.unparsedAddress ?? subject.mlsAreaMajor}</Text>
      <View style={styles.statGrid}>
        {tiles.map(([label, value]) => (
          <View key={label} style={styles.statTile}>
            <View style={styles.statTileInner}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
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
      <SectionHeader>Comp Map</SectionHeader>
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
      <SectionHeader>Comparable Sales</SectionHeader>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "16%" }]}>Photo</Text>
        <Text style={[styles.headerCell, { width: "24%" }]}>Address</Text>
        <Text style={[styles.headerCell, { width: "12%" }]}>Weight</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Base price</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Adjustment</Text>
        <Text style={[styles.headerCell, { width: "16%" }]}>Adjusted value</Text>
      </View>
      {result.selectedComps.map((comp, index) => (
        <View key={comp.listingKey} style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]} wrap={false}>
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
      <SectionHeader>Adjustment Grid</SectionHeader>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "24%" }]}>Address</Text>
        {ADJUSTMENT_FACTORS.map(([factor, label]) => (
          <Text key={factor} style={[styles.headerCell, { width: `${76 / ADJUSTMENT_FACTORS.length}%` }]}>
            {label}
          </Text>
        ))}
      </View>
      {result.selectedComps.map((comp, index) => {
        const byFactor = Object.fromEntries(comp.adjustments.map((item) => [item.factor, item.amount]));
        return (
          <View key={comp.listingKey} style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]} wrap={false}>
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
      <SectionHeader>Pricing Recommendation</SectionHeader>
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
      <SectionHeader>Rationale</SectionHeader>
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
      <SectionHeader>Methodology Appendix</SectionHeader>
      <Text style={styles.p}>
        Adjustment rates for {subject.mlsAreaMajor}, applied per unit of difference between the subject and each
        comparable. A positive line item means the subject exceeds the comparable on that factor.
      </Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: "50%" }]}>Factor</Text>
        <Text style={[styles.headerCell, { width: "50%" }]}>Rate</Text>
      </View>
      {RATE_ROWS.map(([key, label, format], index) => (
        <View key={key} style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]}>
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
