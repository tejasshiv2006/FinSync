CREATE TYPE "public"."finsync_commitment_recurrence" AS ENUM('once', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."finsync_commitment_status" AS ENUM('planned', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."finsync_scenario_status" AS ENUM('saved', 'applied');--> statement-breakpoint
CREATE TYPE "public"."finsync_subscription_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."finsync_subscription_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."finsync_transaction_type" AS ENUM('income', 'expense', 'refund', 'adjustment');--> statement-breakpoint
CREATE TABLE "finsync_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finsync_budget_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"spending_limit_paise" bigint DEFAULT 0 NOT NULL,
	"is_essential" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_budget_categories_limit_nonnegative" CHECK ("finsync_budget_categories"."spending_limit_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_commitments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"due_date" date NOT NULL,
	"recurrence_type" "finsync_commitment_recurrence" DEFAULT 'once' NOT NULL,
	"is_essential" boolean DEFAULT false NOT NULL,
	"status" "finsync_commitment_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_commitments_amount_positive" CHECK ("finsync_commitments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_financial_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"challenge_start_date" date NOT NULL,
	"challenge_duration_days" integer DEFAULT 30 NOT NULL,
	"starting_budget_paise" bigint DEFAULT 1000000 NOT NULL,
	"planned_income_paise" bigint DEFAULT 0 NOT NULL,
	"savings_goal_paise" bigint DEFAULT 200000 NOT NULL,
	"emergency_reserve_target_paise" bigint DEFAULT 0 NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_financial_profiles_duration_positive" CHECK ("finsync_financial_profiles"."challenge_duration_days" > 0 AND "finsync_financial_profiles"."challenge_duration_days" <= 366),
	CONSTRAINT "finsync_financial_profiles_amounts_nonnegative" CHECK ("finsync_financial_profiles"."starting_budget_paise" >= 0 AND "finsync_financial_profiles"."planned_income_paise" >= 0 AND "finsync_financial_profiles"."savings_goal_paise" >= 0 AND "finsync_financial_profiles"."emergency_reserve_target_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"notification_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finsync_savings_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" integer NOT NULL,
	"amount_paise" bigint NOT NULL,
	"contribution_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_savings_contributions_amount_positive" CHECK ("finsync_savings_contributions"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_savings_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"target_amount_paise" bigint NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_savings_goals_target_positive" CHECK ("finsync_savings_goals"."target_amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"scenario_type" text NOT NULL,
	"scenario_data" jsonb NOT NULL,
	"baseline_snapshot" jsonb NOT NULL,
	"projected_results" jsonb NOT NULL,
	"status" "finsync_scenario_status" DEFAULT 'saved' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finsync_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"billing_frequency" "finsync_subscription_frequency" NOT NULL,
	"next_billing_date" date NOT NULL,
	"category" text NOT NULL,
	"status" "finsync_subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_subscriptions_amount_positive" CHECK ("finsync_subscriptions"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_type" "finsync_transaction_type" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"transaction_date" date NOT NULL,
	"is_essential" boolean DEFAULT false NOT NULL,
	"commitment_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finsync_transactions_amount_positive" CHECK ("finsync_transactions"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "finsync_users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'FinSync user' NOT NULL,
	"email" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finsync_audit_events" ADD CONSTRAINT "finsync_audit_events_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_budget_categories" ADD CONSTRAINT "finsync_budget_categories_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_commitments" ADD CONSTRAINT "finsync_commitments_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_financial_profiles" ADD CONSTRAINT "finsync_financial_profiles_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_notifications" ADD CONSTRAINT "finsync_notifications_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_savings_contributions" ADD CONSTRAINT "finsync_savings_contributions_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_savings_contributions" ADD CONSTRAINT "finsync_savings_contributions_goal_id_finsync_savings_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."finsync_savings_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_savings_goals" ADD CONSTRAINT "finsync_savings_goals_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_scenarios" ADD CONSTRAINT "finsync_scenarios_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_subscriptions" ADD CONSTRAINT "finsync_subscriptions_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_transactions" ADD CONSTRAINT "finsync_transactions_user_id_finsync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."finsync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finsync_transactions" ADD CONSTRAINT "finsync_transactions_commitment_id_finsync_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."finsync_commitments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finsync_audit_events_user_created_idx" ON "finsync_audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "finsync_budget_categories_user_name_unique" ON "finsync_budget_categories" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "finsync_commitments_user_due_idx" ON "finsync_commitments" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "finsync_financial_profiles_user_unique" ON "finsync_financial_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finsync_notifications_user_dedupe_unique" ON "finsync_notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "finsync_notifications_user_unread_idx" ON "finsync_notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "finsync_savings_contributions_goal_idx" ON "finsync_savings_contributions" USING btree ("user_id","goal_id");--> statement-breakpoint
CREATE INDEX "finsync_savings_goals_user_idx" ON "finsync_savings_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "finsync_scenarios_user_created_idx" ON "finsync_scenarios" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "finsync_subscriptions_user_next_billing_idx" ON "finsync_subscriptions" USING btree ("user_id","next_billing_date");--> statement-breakpoint
CREATE INDEX "finsync_transactions_user_date_idx" ON "finsync_transactions" USING btree ("user_id","transaction_date");--> statement-breakpoint
CREATE INDEX "finsync_transactions_user_category_idx" ON "finsync_transactions" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "finsync_transactions_commitment_unique" ON "finsync_transactions" USING btree ("commitment_id") WHERE "finsync_transactions"."commitment_id" IS NOT NULL;