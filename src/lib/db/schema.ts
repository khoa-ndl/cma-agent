// Database schema (spec 3). Standard Postgres only: plain tables, enums and
// indexes, so migrations run unchanged on any Postgres host (spec 2.1).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Property (RESO Data Dictionary field names; spec 3.1) ---
// Column names follow RESO so SampleDataProvider and a future
// ResoWebApiProvider (spec 2) read the same shape.

export const standardStatus = pgEnum("standard_status", ["Active", "Pending", "Closed"]);
export const propertyType = pgEnum("property_type", ["Residential"]);
export const propertySubType = pgEnum("property_sub_type", [
  "SingleFamilyResidence",
  "Townhouse",
  "Condominium",
]);
export const propertyCondition = pgEnum("property_condition", [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
]);

export const property = pgTable(
  "property",
  {
    listingKey: text("listing_key").primaryKey(),
    listingId: text("listing_id").notNull(),
    standardStatus: standardStatus("standard_status").notNull(),
    propertyType: propertyType("property_type").notNull(),
    propertySubType: propertySubType("property_sub_type").notNull(),
    unparsedAddress: text("unparsed_address").notNull(),
    city: text("city").notNull(),
    stateOrProvince: text("state_or_province").notNull(),
    postalCode: text("postal_code").notNull(),
    mlsAreaMajor: text("mls_area_major").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    bedroomsTotal: integer("bedrooms_total").notNull(),
    bathroomsTotalInteger: integer("bathrooms_total_integer").notNull(),
    livingArea: integer("living_area").notNull(),
    // Null for condominiums (spec 3.1).
    lotSizeSquareFeet: integer("lot_size_square_feet"),
    yearBuilt: integer("year_built").notNull(),
    garageSpaces: integer("garage_spaces").notNull(),
    propertyCondition: propertyCondition("property_condition").notNull(),
    listPrice: integer("list_price").notNull(),
    originalListPrice: integer("original_list_price").notNull(),
    // Closed only.
    closePrice: integer("close_price"),
    listingContractDate: date("listing_contract_date").notNull(),
    closeDate: date("close_date"),
    daysOnMarket: integer("days_on_market").notNull(),
  },
  (t) => [
    // Address autocomplete (spec 2) and comp search filter by status.
    index("property_address_idx").on(t.unparsedAddress),
    index("property_status_idx").on(t.standardStatus),
    index("property_area_idx").on(t.mlsAreaMajor),
  ],
);

// --- Access, credits and reports (spec 3.3) ---

export const accessCodes = pgTable(
  "access_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Codes are random and stored hashed; the plain code is shown once, at
    // issue time, by scripts/issue-code.ts (spec 6, Step 6).
    codeHash: text("code_hash").notNull().unique(),
    label: text("label").notNull(),
    creditsBalance: integer("credits_balance").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Defense in depth: the credit service (Step 6) is the real guard, but
    // the balance the whole budget design depends on should be impossible
    // to drive negative even if that logic has a bug.
    check("access_codes_credits_balance_non_negative", sql`${t.creditsBalance} >= 0`),
  ],
);

export const reportStatus = pgEnum("report_status", ["running", "succeeded", "failed"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accessCodeId: uuid("access_code_id")
      .notNull()
      .references(() => accessCodes.id),
    status: reportStatus("status").notNull().default("running"),
    subject: jsonb("subject").notNull(),
    result: jsonb("result"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    // Enforces "one active report per user" at the database (spec 3.3, A9):
    // a second insert with status 'running' for the same code is rejected.
    uniqueIndex("reports_one_running_per_code")
      .on(t.accessCodeId)
      .where(sql`${t.status} = 'running'`),
  ],
);

export const ledgerReason = pgEnum("ledger_reason", ["grant", "report", "refund", "chat"]);

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  accessCodeId: uuid("access_code_id")
    .notNull()
    .references(() => accessCodes.id),
  delta: integer("delta").notNull(),
  reason: ledgerReason("reason").notNull(),
  reportId: uuid("report_id").references(() => reports.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rate limiting for access code attempts (plan.md Departures: serverless
// functions keep no memory between requests, so attempts live here).
export const accessAttempts = pgTable(
  "access_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipAddress: text("ip_address").notNull(),
    succeeded: boolean("succeeded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("access_attempts_ip_time_idx").on(t.ipAddress, t.createdAt)],
);

// Rate limiting for admin login attempts. A dedicated table, not shared
// with accessAttempts, so an attacker hammering one can't lock out the
// other's budget (operator-dashboard spec.md, Decisions).
export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipAddress: text("ip_address").notNull(),
    succeeded: boolean("succeeded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_login_attempts_ip_time_idx").on(t.ipAddress, t.createdAt)],
);
