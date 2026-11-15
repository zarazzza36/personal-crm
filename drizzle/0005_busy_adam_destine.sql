CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sign_in_link_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sign_in_link_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION replace_magic_link_verification() RETURNS trigger AS $$
DECLARE
  link_email text;
BEGIN
  IF NEW.identifier LIKE 'magic-link:%' THEN
    link_email := NEW.value::jsonb ->> 'email';
    IF link_email IS NULL OR link_email <> lower(trim(link_email)) THEN
      RAISE EXCEPTION 'Magic link email must be normalized';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(link_email));
    DELETE FROM verifications
      WHERE CASE WHEN identifier LIKE 'magic-link:%'
        THEN value::jsonb ->> 'email' = link_email ELSE false END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER replace_magic_link_verification_before_insert
  BEFORE INSERT ON verifications FOR EACH ROW EXECUTE FUNCTION replace_magic_link_verification();
--> statement-breakpoint
DROP INDEX "groups_name_key";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "user_id" text;--> statement-breakpoint
DO $$
DECLARE
  owner_email text := lower(trim(current_setting('crm.owner_email', true)));
  owner_id text := gen_random_uuid()::text;
BEGIN
  IF EXISTS (SELECT 1 FROM contacts) OR EXISTS (SELECT 1 FROM groups) THEN
    IF owner_email IS NULL OR owner_email = '' THEN
      RAISE EXCEPTION 'OWNER_EMAIL is required to migrate existing contacts and groups';
    END IF;
    INSERT INTO users (id, name, email, email_verified) VALUES (owner_id, '', owner_email, true);
    UPDATE contacts SET user_id = owner_id;
    UPDATE groups SET user_id = owner_id;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sign_in_link_requests_email_created_at_idx" ON "sign_in_link_requests" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_user_id_name_idx" ON "contacts" USING btree ("user_id","name" collate "ru-x-icu","id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_user_id_name_key" ON "groups" USING btree ("user_id",lower("name" collate "ru-x-icu"));
