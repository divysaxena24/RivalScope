CREATE TABLE "scrape_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"tracked_url_id" uuid,
	"source_url" text NOT NULL,
	"page_title" varchar(500),
	"markdown_content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'SUCCESS' NOT NULL,
	"error_message" text,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_tracked_url_id_tracked_urls_id_fk" FOREIGN KEY ("tracked_url_id") REFERENCES "public"."tracked_urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scrape_results_competitor_id_idx" ON "scrape_results" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "scrape_results_tracked_url_id_idx" ON "scrape_results" USING btree ("tracked_url_id");--> statement-breakpoint
CREATE INDEX "scrape_results_scraped_at_idx" ON "scrape_results" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "scrape_results_content_hash_idx" ON "scrape_results" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "scrape_results_status_idx" ON "scrape_results" USING btree ("status");