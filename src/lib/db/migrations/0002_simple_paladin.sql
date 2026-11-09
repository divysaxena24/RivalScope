ALTER TABLE "pricing_changes" ADD COLUMN "previous_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD COLUMN "current_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD COLUMN "absolute_difference" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD COLUMN "percentage_difference" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_previous_snapshot_id_pricing_snapshots_id_fk" FOREIGN KEY ("previous_snapshot_id") REFERENCES "public"."pricing_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_current_snapshot_id_pricing_snapshots_id_fk" FOREIGN KEY ("current_snapshot_id") REFERENCES "public"."pricing_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pricing_changes_pricing_plan_id_idx" ON "pricing_changes" USING btree ("pricing_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_changes_dedup_idx" ON "pricing_changes" USING btree ("competitor_id","pricing_plan_id","previous_snapshot_id","current_snapshot_id","change_type","field_name");