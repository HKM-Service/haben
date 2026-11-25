ALTER TABLE "invoices" ADD COLUMN "brand_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "default_for_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "website" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "bank_account_id" uuid;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "intro" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "logo" "bytea";--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "logo_format" text;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "logo_hash" text;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "background" "bytea";--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "background_format" text;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD COLUMN "background_hash" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "brand_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD COLUMN "brand_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_brand_profile_id_letterhead_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."letterhead_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_brand_profile_id_letterhead_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."letterhead_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_brand_profile_id_letterhead_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."letterhead_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "letterhead_profiles_brand_default" ON "letterhead_profiles" USING btree ("default_for_new") WHERE "letterhead_profiles"."default_for_new";--> statement-breakpoint
CREATE UNIQUE INDEX "letterhead_profiles_brand_name" ON "letterhead_profiles" USING btree (lower("name")) WHERE not "letterhead_profiles"."is_default" and "letterhead_profiles"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_brand_default_active" CHECK (not "letterhead_profiles"."default_for_new" or (not "letterhead_profiles"."is_default" and "letterhead_profiles"."archived_at" is null));--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_logo_pair" CHECK (num_nonnulls("letterhead_profiles"."logo", "letterhead_profiles"."logo_format", "letterhead_profiles"."logo_hash") in (0, 3));--> statement-breakpoint
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_background_pair" CHECK (num_nonnulls("letterhead_profiles"."background", "letterhead_profiles"."background_format", "letterhead_profiles"."background_hash") in (0, 3));