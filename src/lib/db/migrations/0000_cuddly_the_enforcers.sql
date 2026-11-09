CREATE TABLE "ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"impact" varchar(20) DEFAULT 'medium',
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendation" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"website" text NOT NULL,
	"domain" varchar(255) NOT NULL,
	"industry" varchar(255),
	"description" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"pricing_plan_id" uuid,
	"feature_name" varchar(255) NOT NULL,
	"feature_value" text,
	"source_url" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"pricing_plan_id" uuid,
	"change_type" varchar(50) NOT NULL,
	"field_name" varchar(100),
	"old_value" jsonb,
	"new_value" jsonb,
	"description" text,
	"source_url" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"billing_period" varchar(50) DEFAULT 'monthly',
	"is_custom_pricing" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"pricing_plan_id" uuid,
	"plan_name" varchar(255) NOT NULL,
	"price" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"billing_period" varchar(50),
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"url" text NOT NULL,
	"page_type" varchar(50) DEFAULT 'pricing' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"last_scan_status" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_snapshots" ADD CONSTRAINT "feature_snapshots_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_snapshots" ADD CONSTRAINT "feature_snapshots_pricing_plan_id_pricing_plans_id_fk" FOREIGN KEY ("pricing_plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_pricing_plan_id_pricing_plans_id_fk" FOREIGN KEY ("pricing_plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_pricing_plan_id_pricing_plans_id_fk" FOREIGN KEY ("pricing_plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_urls" ADD CONSTRAINT "tracked_urls_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_insights_competitor_id_idx" ON "ai_insights" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "ai_insights_generated_at_idx" ON "ai_insights" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "ai_insights_insight_type_idx" ON "ai_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE UNIQUE INDEX "competitors_domain_idx" ON "competitors" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "competitors_name_idx" ON "competitors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "feature_snapshots_competitor_id_idx" ON "feature_snapshots" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "feature_snapshots_pricing_plan_id_idx" ON "feature_snapshots" USING btree ("pricing_plan_id");--> statement-breakpoint
CREATE INDEX "feature_snapshots_observed_at_idx" ON "feature_snapshots" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "pricing_changes_competitor_id_idx" ON "pricing_changes" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "pricing_changes_change_type_idx" ON "pricing_changes" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "pricing_changes_detected_at_idx" ON "pricing_changes" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "pricing_plans_competitor_id_idx" ON "pricing_plans" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "pricing_plans_is_active_idx" ON "pricing_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pricing_snapshots_competitor_id_idx" ON "pricing_snapshots" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "pricing_snapshots_pricing_plan_id_idx" ON "pricing_snapshots" USING btree ("pricing_plan_id");--> statement-breakpoint
CREATE INDEX "pricing_snapshots_observed_at_idx" ON "pricing_snapshots" USING btree ("observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_urls_competitor_url_idx" ON "tracked_urls" USING btree ("competitor_id","url");--> statement-breakpoint
CREATE INDEX "tracked_urls_competitor_id_idx" ON "tracked_urls" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "tracked_urls_is_active_idx" ON "tracked_urls" USING btree ("is_active");