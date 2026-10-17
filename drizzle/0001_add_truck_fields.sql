CREATE TYPE "public"."body_type" AS ENUM('tent', 'refrigerator', 'isothermal', 'van', 'flatbed', 'container_carrier', 'dump_truck', 'lowboy');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "capacity_tons" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "volume_cubic_meters" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "body_type" "body_type";