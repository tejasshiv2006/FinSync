import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const paise = (name: string) => bigint(name, { mode: "number" });
const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const transactionTypeEnum = pgEnum("finsync_transaction_type", [
  "income",
  "expense",
  "refund",
  "adjustment",
]);
export const commitmentRecurrenceEnum = pgEnum("finsync_commitment_recurrence", [
  "once",
  "weekly",
  "monthly",
  "yearly",
]);
export const commitmentStatusEnum = pgEnum("finsync_commitment_status", [
  "planned",
  "paid",
  "cancelled",
]);
export const subscriptionFrequencyEnum = pgEnum("finsync_subscription_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
export const subscriptionStatusEnum = pgEnum("finsync_subscription_status", [
  "active",
  "paused",
  "cancelled",
]);
export const scenarioStatusEnum = pgEnum("finsync_scenario_status", [
  "saved",
  "applied",
]);

export const usersTable = pgTable("finsync_users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull().default("FinSync user"),
  email: text("email"),
  currency: text("currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const financialProfilesTable = pgTable(
  "finsync_financial_profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    challengeStartDate: date("challenge_start_date", { mode: "string" }).notNull(),
    challengeDurationDays: integer("challenge_duration_days").notNull().default(30),
    startingBudgetPaise: paise("starting_budget_paise").notNull().default(1_000_000),
    plannedIncomePaise: paise("planned_income_paise").notNull().default(0),
    dailyDiscretionaryTargetPaise: paise("daily_discretionary_target_paise"),
    savingsGoalPaise: paise("savings_goal_paise").notNull().default(200_000),
    emergencyReserveTargetPaise: paise("emergency_reserve_target_paise")
      .notNull()
      .default(0),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("finsync_financial_profiles_user_unique").on(table.userId),
    check(
      "finsync_financial_profiles_duration_positive",
      sql`${table.challengeDurationDays} > 0 AND ${table.challengeDurationDays} <= 366`,
    ),
    check(
      "finsync_financial_profiles_amounts_nonnegative",
      sql`${table.startingBudgetPaise} >= 0 AND ${table.plannedIncomePaise} >= 0 AND ${table.savingsGoalPaise} >= 0 AND ${table.emergencyReserveTargetPaise} >= 0`,
    ),
  ],
);

export const commitmentsTable = pgTable(
  "finsync_commitments",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    amountPaise: paise("amount_paise").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    recurrenceType: commitmentRecurrenceEnum("recurrence_type").notNull().default("once"),
    isEssential: boolean("is_essential").notNull().default(false),
    status: commitmentStatusEnum("status").notNull().default("planned"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finsync_commitments_user_due_idx").on(table.userId, table.dueDate),
    check("finsync_commitments_amount_positive", sql`${table.amountPaise} > 0`),
  ],
);

export const transactionsTable = pgTable(
  "finsync_transactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    amountPaise: paise("amount_paise").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    isEssential: boolean("is_essential").notNull().default(false),
    commitmentId: integer("commitment_id").references(() => commitmentsTable.id, {
      onDelete: "set null",
    }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finsync_transactions_user_date_idx").on(table.userId, table.transactionDate),
    index("finsync_transactions_user_category_idx").on(table.userId, table.category),
    uniqueIndex("finsync_transactions_commitment_unique")
      .on(table.commitmentId)
      .where(sql`${table.commitmentId} IS NOT NULL`),
    check("finsync_transactions_amount_positive", sql`${table.amountPaise} > 0`),
  ],
);

export const budgetCategoriesTable = pgTable(
  "finsync_budget_categories",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    spendingLimitPaise: paise("spending_limit_paise").notNull().default(0),
    isEssential: boolean("is_essential").notNull().default(false),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("finsync_budget_categories_user_name_unique").on(table.userId, table.name),
    check(
      "finsync_budget_categories_limit_nonnegative",
      sql`${table.spendingLimitPaise} >= 0`,
    ),
  ],
);

export const savingsGoalsTable = pgTable(
  "finsync_savings_goals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmountPaise: paise("target_amount_paise").notNull(),
    targetDate: date("target_date", { mode: "string" }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finsync_savings_goals_user_idx").on(table.userId),
    check("finsync_savings_goals_target_positive", sql`${table.targetAmountPaise} > 0`),
  ],
);

export const savingsContributionsTable = pgTable(
  "finsync_savings_contributions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => savingsGoalsTable.id, { onDelete: "cascade" }),
    amountPaise: paise("amount_paise").notNull(),
    contributionDate: date("contribution_date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: now(),
  },
  (table) => [
    index("finsync_savings_contributions_goal_idx").on(table.userId, table.goalId),
    check("finsync_savings_contributions_amount_positive", sql`${table.amountPaise} > 0`),
  ],
);

export const subscriptionsTable = pgTable(
  "finsync_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountPaise: paise("amount_paise").notNull(),
    billingFrequency: subscriptionFrequencyEnum("billing_frequency").notNull(),
    nextBillingDate: date("next_billing_date", { mode: "string" }).notNull(),
    category: text("category").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("finsync_subscriptions_user_next_billing_idx").on(
      table.userId,
      table.nextBillingDate,
    ),
    check("finsync_subscriptions_amount_positive", sql`${table.amountPaise} > 0`),
  ],
);

export const scenariosTable = pgTable(
  "finsync_scenarios",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scenarioType: text("scenario_type").notNull(),
    scenarioData: jsonb("scenario_data").notNull().$type<Record<string, unknown>>(),
    baselineSnapshot: jsonb("baseline_snapshot")
      .notNull()
      .$type<Record<string, unknown>>(),
    projectedResults: jsonb("projected_results")
      .notNull()
      .$type<Record<string, unknown>>(),
    status: scenarioStatusEnum("status").notNull().default("saved"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("finsync_scenarios_user_created_idx").on(table.userId, table.createdAt)],
);

export const notificationsTable = pgTable(
  "finsync_notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: now(),
  },
  (table) => [
    uniqueIndex("finsync_notifications_user_dedupe_unique").on(table.userId, table.dedupeKey),
    index("finsync_notifications_user_unread_idx").on(table.userId, table.isRead),
  ],
);

export const auditEventsTable = pgTable(
  "finsync_audit_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    safeMetadata: jsonb("safe_metadata").notNull().default({}),
    createdAt: now(),
  },
  (table) => [index("finsync_audit_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const financeUsersRelations = relations(usersTable, ({ many, one }) => ({
  profile: one(financialProfilesTable),
  transactions: many(transactionsTable),
  commitments: many(commitmentsTable),
  subscriptions: many(subscriptionsTable),
  savingsGoals: many(savingsGoalsTable),
}));
