import {
  pgTable,
  uuid,
  text,
  varchar,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * A. Competitors
 * Stores companies being monitored.
 */
export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    website: text("website").notNull(),
    domain: varchar("domain", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 255 }),
    description: text("description"),
    logoUrl: text("logo_url"),
    status: varchar("status", { length: 20 }).default("active").notNull(), // active, archived
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("competitors_domain_idx").on(table.domain),
    index("competitors_name_idx").on(table.name),
    index("competitors_status_idx").on(table.status),
  ]
);

/**
 * B. Tracked URLs
 * Stores individual pages monitored for a competitor (pricing, features, product, etc.).
 */
export const trackedUrls = pgTable(
  "tracked_urls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    pageType: varchar("page_type", { length: 50 }).default("pricing").notNull(), // pricing, features, product, other
    isActive: boolean("is_active").default(true).notNull(),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    lastScanStatus: varchar("last_scan_status", { length: 50 }),
    lastExtractionStatus: varchar("last_extraction_status", { length: 50 }), // PENDING, RUNNING, SUCCESS, NO_PRICING_FOUND, FAILED, FLAGGED_FOR_REVIEW
    lastExtractedAt: timestamp("last_extracted_at", { withTimezone: true }),
    lastExtractionError: text("last_extraction_error"),
    lastExtractedPlanCount: numeric("last_extracted_plan_count").default("0"),
    lastExtractedFeatureCount: numeric("last_extracted_feature_count").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tracked_urls_competitor_url_idx").on(
      table.competitorId,
      table.url
    ),
    index("tracked_urls_competitor_id_idx").on(table.competitorId),
    index("tracked_urls_is_active_idx").on(table.isActive),
  ]
);

/**
 * C. Pricing Plans
 * Stores current normalized pricing plans.
 */
export const pricingPlans = pgTable(
  "pricing_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    planName: varchar("plan_name", { length: 255 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }), // numeric for accurate currency calculation
    currency: varchar("currency", { length: 10 }).default("USD"),
    billingPeriod: varchar("billing_period", { length: 50 }).default("monthly"), // monthly, yearly, one_time, custom
    isCustomPricing: boolean("is_custom_pricing").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    features: jsonb("features").$type<string[]>().default([]).notNull(),
    usageLimits: jsonb("usage_limits").$type<Record<string, unknown>>().default({}).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pricing_plans_competitor_id_idx").on(table.competitorId),
    index("pricing_plans_is_active_idx").on(table.isActive),
  ]
);

/**
 * D. Pricing Snapshots
 * Immutable historical observations of pricing plans over time.
 */
export const pricingSnapshots = pgTable(
  "pricing_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    pricingPlanId: uuid("pricing_plan_id").references(() => pricingPlans.id, {
      onDelete: "set null",
    }),
    planName: varchar("plan_name", { length: 255 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 10 }).default("USD"),
    billingPeriod: varchar("billing_period", { length: 50 }),
    features: jsonb("features").$type<string[]>().default([]).notNull(),
    usageLimits: jsonb("usage_limits").$type<Record<string, unknown>>().default({}).notNull(),
    sourceUrl: text("source_url"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pricing_snapshots_competitor_id_idx").on(table.competitorId),
    index("pricing_snapshots_pricing_plan_id_idx").on(table.pricingPlanId),
    index("pricing_snapshots_observed_at_idx").on(table.observedAt),
  ]
);

/**
 * E. Feature Snapshots
 * Immutable historical observations of features.
 */
export const featureSnapshots = pgTable(
  "feature_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    pricingPlanId: uuid("pricing_plan_id").references(() => pricingPlans.id, {
      onDelete: "set null",
    }),
    trackedUrlId: uuid("tracked_url_id").references(() => trackedUrls.id, {
      onDelete: "set null",
    }),
    scrapeResultId: uuid("scrape_result_id").references(() => scrapeResults.id, {
      onDelete: "set null",
    }),
    batchId: uuid("batch_id"),
    featureName: varchar("feature_name", { length: 255 }).notNull(),
    featureValue: text("feature_value"),
    sourceUrl: text("source_url"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feature_snapshots_competitor_id_idx").on(table.competitorId),
    index("feature_snapshots_pricing_plan_id_idx").on(table.pricingPlanId),
    index("feature_snapshots_tracked_url_id_idx").on(table.trackedUrlId),
    index("feature_snapshots_scrape_result_id_idx").on(table.scrapeResultId),
    index("feature_snapshots_batch_id_idx").on(table.batchId),
    index("feature_snapshots_observed_at_idx").on(table.observedAt),
  ]
);

/**
 * F. Pricing Changes
 * Stores detected changes between crawl observations.
 * Supports: PRICE_INCREASED, PRICE_DECREASED, PRICE_BECAME_FREE, PRICE_NO_LONGER_FREE,
 *           CUSTOM_PRICING_INTRODUCED, CUSTOM_PRICING_REMOVED, CURRENCY_CHANGED,
 *           BILLING_PERIOD_CHANGED, PLAN_ADDED, PLAN_REMOVED, FEATURE_ADDED, FEATURE_REMOVED,
 *           FEATURE_INCLUDED, FEATURE_EXCLUDED, FEATURE_LIMITED, FEATURE_LIMIT_INCREASED,
 *           FEATURE_LIMIT_DECREASED, LIMIT_INCREASED, LIMIT_DECREASED
 */
export const pricingChanges = pgTable(
  "pricing_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    pricingPlanId: uuid("pricing_plan_id").references(() => pricingPlans.id, {
      onDelete: "set null",
    }),
    previousSnapshotId: uuid("previous_snapshot_id").references(
      () => pricingSnapshots.id,
      { onDelete: "set null" }
    ),
    currentSnapshotId: uuid("current_snapshot_id").references(
      () => pricingSnapshots.id,
      { onDelete: "set null" }
    ),
    changeType: varchar("change_type", { length: 50 }).notNull(),
    fieldName: varchar("field_name", { length: 100 }),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    absoluteDifference: numeric("absolute_difference", { precision: 12, scale: 2 }),
    percentageDifference: numeric("percentage_difference", { precision: 8, scale: 2 }),
    description: text("description"),
    sourceUrl: text("source_url"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pricing_changes_competitor_id_idx").on(table.competitorId),
    index("pricing_changes_pricing_plan_id_idx").on(table.pricingPlanId),
    index("pricing_changes_change_type_idx").on(table.changeType),
    index("pricing_changes_detected_at_idx").on(table.detectedAt),
    uniqueIndex("pricing_changes_dedup_idx").on(
      table.competitorId,
      table.pricingPlanId,
      table.previousSnapshotId,
      table.currentSnapshotId,
      table.changeType,
      table.fieldName
    ),
  ]
);

/**
 * G. AI Insights
 * Stores generated competitive intelligence takeaways and recommendations.
 */
export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id").references(() => competitors.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    insightType: varchar("insight_type", { length: 50 }).notNull(), // pricing, packaging, discount, positioning
    impact: varchar("impact", { length: 20 }).default("medium"), // high, medium, low
    evidence: jsonb("evidence").$type<Record<string, unknown>>().default({}).notNull(),
    recommendation: text("recommendation"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ai_insights_competitor_id_idx").on(table.competitorId),
    index("ai_insights_generated_at_idx").on(table.generatedAt),
    index("ai_insights_insight_type_idx").on(table.insightType),
  ]
);

/**
 * H. Scrape Results
 * Stores raw scraping observations, Markdown contents, metadata, and content hashes.
 */
export const scrapeResults = pgTable(
  "scrape_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    trackedUrlId: uuid("tracked_url_id").references(() => trackedUrls.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url").notNull(),
    pageTitle: varchar("page_title", { length: 500 }),
    markdownContent: text("markdown_content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(), // deterministic sha256
    status: varchar("status", { length: 20 }).default("SUCCESS").notNull(), // SUCCESS or FAILED
    errorMessage: text("error_message"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scrape_results_competitor_id_idx").on(table.competitorId),
    index("scrape_results_tracked_url_id_idx").on(table.trackedUrlId),
    index("scrape_results_scraped_at_idx").on(table.scrapedAt),
    index("scrape_results_content_hash_idx").on(table.contentHash),
    index("scrape_results_status_idx").on(table.status),
  ]
);

/**
 * I. Monitoring Runs
 * Tracks daily or on-demand automated scheduler runs.
 * Statuses: PENDING, RUNNING, SUCCESS, PARTIAL_SUCCESS, FAILED
 */
export const monitoringRuns = pgTable(
  "monitoring_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runType: varchar("run_type", { length: 50 }).default("scheduled").notNull(), // scheduled, manual
    status: varchar("status", { length: 30 }).default("PENDING").notNull(), // PENDING, RUNNING, SUCCESS, PARTIAL_SUCCESS, FAILED
    totalCompetitors: numeric("total_competitors").default("0").notNull(),
    totalUrls: numeric("total_urls").default("0").notNull(),
    successfulScrapes: numeric("successful_scrapes").default("0").notNull(),
    failedScrapes: numeric("failed_scrapes").default("0").notNull(),
    detectedPriceChanges: numeric("detected_price_changes").default("0").notNull(),
    detectedFeatureChanges: numeric("detected_feature_changes").default("0").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [
    index("monitoring_runs_status_idx").on(table.status),
    index("monitoring_runs_started_at_idx").on(table.startedAt),
  ]
);

/**
 * J. Monitoring Jobs
 * Tracks individual tracked URL tasks within a monitoring run with retry accounting.
 */
export const monitoringJobs = pgTable(
  "monitoring_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => monitoringRuns.id, { onDelete: "cascade" }),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    trackedUrlId: uuid("tracked_url_id")
      .notNull()
      .references(() => trackedUrls.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).default("PENDING").notNull(), // PENDING, RUNNING, SUCCESS, FAILED
    retryCount: numeric("retry_count").default("0").notNull(),
    maxRetries: numeric("max_retries").default("2").notNull(),
    scrapeResultId: uuid("scrape_result_id").references(() => scrapeResults.id, {
      onDelete: "set null",
    }),
    detectedChangesCount: numeric("detected_changes_count").default("0").notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("monitoring_jobs_run_id_idx").on(table.runId),
    index("monitoring_jobs_status_idx").on(table.status),
    index("monitoring_jobs_tracked_url_id_idx").on(table.trackedUrlId),
  ]
);

/**
 * Relations
 */
export const competitorsRelations = relations(competitors, ({ many }) => ({
  trackedUrls: many(trackedUrls),
  pricingPlans: many(pricingPlans),
  pricingSnapshots: many(pricingSnapshots),
  featureSnapshots: many(featureSnapshots),
  pricingChanges: many(pricingChanges),
  aiInsights: many(aiInsights),
  scrapeResults: many(scrapeResults),
}));

export const trackedUrlsRelations = relations(trackedUrls, ({ one, many }) => ({
  competitor: one(competitors, {
    fields: [trackedUrls.competitorId],
    references: [competitors.id],
  }),
  scrapeResults: many(scrapeResults),
}));

export const pricingPlansRelations = relations(pricingPlans, ({ one, many }) => ({
  competitor: one(competitors, {
    fields: [pricingPlans.competitorId],
    references: [competitors.id],
  }),
  snapshots: many(pricingSnapshots),
  changes: many(pricingChanges),
}));

export const pricingSnapshotsRelations = relations(
  pricingSnapshots,
  ({ one }) => ({
    competitor: one(competitors, {
      fields: [pricingSnapshots.competitorId],
      references: [competitors.id],
    }),
    pricingPlan: one(pricingPlans, {
      fields: [pricingSnapshots.pricingPlanId],
      references: [pricingPlans.id],
    }),
  })
);

export const featureSnapshotsRelations = relations(
  featureSnapshots,
  ({ one }) => ({
    competitor: one(competitors, {
      fields: [featureSnapshots.competitorId],
      references: [competitors.id],
    }),
    pricingPlan: one(pricingPlans, {
      fields: [featureSnapshots.pricingPlanId],
      references: [pricingPlans.id],
    }),
    trackedUrl: one(trackedUrls, {
      fields: [featureSnapshots.trackedUrlId],
      references: [trackedUrls.id],
    }),
    scrapeResult: one(scrapeResults, {
      fields: [featureSnapshots.scrapeResultId],
      references: [scrapeResults.id],
    }),
  })
);

export const pricingChangesRelations = relations(pricingChanges, ({ one }) => ({
  competitor: one(competitors, {
    fields: [pricingChanges.competitorId],
    references: [competitors.id],
  }),
  pricingPlan: one(pricingPlans, {
    fields: [pricingChanges.pricingPlanId],
    references: [pricingPlans.id],
  }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  competitor: one(competitors, {
    fields: [aiInsights.competitorId],
    references: [competitors.id],
  }),
}));

export const scrapeResultsRelations = relations(scrapeResults, ({ one }) => ({
  competitor: one(competitors, {
    fields: [scrapeResults.competitorId],
    references: [competitors.id],
  }),
  trackedUrl: one(trackedUrls, {
    fields: [scrapeResults.trackedUrlId],
    references: [trackedUrls.id],
  }),
}));

export const monitoringRunsRelations = relations(monitoringRuns, ({ many }) => ({
  jobs: many(monitoringJobs),
}));

export const monitoringJobsRelations = relations(monitoringJobs, ({ one }) => ({
  run: one(monitoringRuns, {
    fields: [monitoringJobs.runId],
    references: [monitoringRuns.id],
  }),
  competitor: one(competitors, {
    fields: [monitoringJobs.competitorId],
    references: [competitors.id],
  }),
  trackedUrl: one(trackedUrls, {
    fields: [monitoringJobs.trackedUrlId],
    references: [trackedUrls.id],
  }),
  scrapeResult: one(scrapeResults, {
    fields: [monitoringJobs.scrapeResultId],
    references: [scrapeResults.id],
  }),
}));
