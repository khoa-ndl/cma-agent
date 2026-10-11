CREATE TYPE "public"."ledger_reason" AS ENUM('grant', 'report', 'refund', 'chat');--> statement-breakpoint
CREATE TYPE "public"."property_condition" AS ENUM('Excellent', 'Good', 'Fair', 'Poor');--> statement-breakpoint
CREATE TYPE "public"."property_sub_type" AS ENUM('SingleFamilyResidence', 'Townhouse', 'Condominium');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('Residential');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."standard_status" AS ENUM('Active', 'Pending', 'Closed');--> statement-breakpoint
CREATE TABLE "access_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"label" text NOT NULL,
	"credits_balance" integer NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_codes_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "access_codes_credits_balance_non_negative" CHECK ("access_codes"."credits_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_code_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"listing_key" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"standard_status" "standard_status" NOT NULL,
	"property_type" "property_type" NOT NULL,
	"property_sub_type" "property_sub_type" NOT NULL,
	"unparsed_address" text NOT NULL,
	"city" text NOT NULL,
	"state_or_province" text NOT NULL,
	"postal_code" text NOT NULL,
	"mls_area_major" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"bedrooms_total" integer NOT NULL,
	"bathrooms_total_integer" integer NOT NULL,
	"living_area" integer NOT NULL,
	"lot_size_square_feet" integer,
	"year_built" integer NOT NULL,
	"garage_spaces" integer NOT NULL,
	"property_condition" "property_condition" NOT NULL,
	"list_price" integer NOT NULL,
	"original_list_price" integer NOT NULL,
	"close_price" integer,
	"listing_contract_date" date NOT NULL,
	"close_date" date,
	"days_on_market" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_code_id" uuid NOT NULL,
	"status" "report_status" DEFAULT 'running' NOT NULL,
	"subject" jsonb NOT NULL,
	"result" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cost_usd" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_attempts_ip_time_idx" ON "access_attempts" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX "property_address_idx" ON "property" USING btree ("unparsed_address");--> statement-breakpoint
CREATE INDEX "property_status_idx" ON "property" USING btree ("standard_status");--> statement-breakpoint
CREATE INDEX "property_area_idx" ON "property" USING btree ("mls_area_major");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_one_running_per_code" ON "reports" USING btree ("access_code_id") WHERE "reports"."status" = 'running';