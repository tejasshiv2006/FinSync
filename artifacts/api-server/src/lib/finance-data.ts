import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  budgetCategoriesTable,
  commitmentsTable,
  db,
  financialProfilesTable,
  savingsContributionsTable,
  savingsGoalsTable,
  subscriptionsTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  calculateFinance,
  localDateInTimezone,
  type FinanceInput,
} from "./finance-engine";

export type RequestUserId = { userId?: string };

export function userIdFromRequest(request: RequestUserId): string | null {
  return request.userId ?? null;
}

export async function ensureProfile(userId: string) {
  await db.insert(usersTable).values({ id: userId }).onConflictDoNothing();
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const timezone = existingUser[0]?.timezone ?? "Asia/Kolkata";
  await db
    .insert(financialProfilesTable)
    .values({
      userId,
      challengeStartDate: localDateInTimezone(timezone),
      challengeDurationDays: 30,
      startingBudgetPaise: 1_000_000,
      plannedIncomePaise: 0,
      savingsGoalPaise: 200_000,
      emergencyReserveTargetPaise: 0,
      onboardingCompleted: false,
    })
    .onConflictDoNothing();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [profile] = await db
    .select()
    .from(financialProfilesTable)
    .where(eq(financialProfilesTable.userId, userId))
    .limit(1);
  if (!user || !profile) {
    throw new Error("Could not initialize the authenticated user's finance profile.");
  }
  return { user, profile };
}

export function toProfile(user: typeof usersTable.$inferSelect, profile: typeof financialProfilesTable.$inferSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    currency: user.currency as "INR",
    timezone: user.timezone,
    challengeStartDate: profile.challengeStartDate,
    challengeDurationDays: profile.challengeDurationDays,
    startingBudgetPaise: profile.startingBudgetPaise,
    plannedIncomePaise: profile.plannedIncomePaise,
    dailyDiscretionaryTargetPaise: profile.dailyDiscretionaryTargetPaise,
    savingsGoalPaise: profile.savingsGoalPaise,
    emergencyReserveTargetPaise: profile.emergencyReserveTargetPaise,
    onboardingCompleted: profile.onboardingCompleted,
  };
}

export function toTransaction(row: typeof transactionsTable.$inferSelect) {
  return {
    id: row.id,
    type: row.transactionType,
    amountPaise: row.amountPaise,
    category: row.category,
    description: row.description,
    transactionDate: row.transactionDate,
    isEssential: row.isEssential,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCommitment(
  row: typeof commitmentsTable.$inferSelect,
  paidTransactionId: number | null = null,
) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amountPaise: row.amountPaise,
    dueDate: row.dueDate,
    recurrenceType: row.recurrenceType,
    isEssential: row.isEssential,
    status: row.status,
    paidTransactionId,
  };
}

export function toSubscription(row: typeof subscriptionsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    amountPaise: row.amountPaise,
    billingFrequency: row.billingFrequency,
    nextBillingDate: row.nextBillingDate,
    category: row.category,
    status: row.status,
  };
}

export async function loadFinanceData(userId: string) {
  const { user, profile } = await ensureProfile(userId);
  const [transactions, commitments, subscriptions, goals, contributions, categories] =
    await Promise.all([
      db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.userId, userId))
        .orderBy(desc(transactionsTable.transactionDate), desc(transactionsTable.createdAt)),
      db
        .select()
        .from(commitmentsTable)
        .where(eq(commitmentsTable.userId, userId))
        .orderBy(asc(commitmentsTable.dueDate)),
      db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId))
        .orderBy(asc(subscriptionsTable.nextBillingDate)),
      db
        .select()
        .from(savingsGoalsTable)
        .where(eq(savingsGoalsTable.userId, userId))
        .orderBy(desc(savingsGoalsTable.createdAt)),
      db
        .select()
        .from(savingsContributionsTable)
        .where(eq(savingsContributionsTable.userId, userId))
        .orderBy(desc(savingsContributionsTable.contributionDate)),
      db
        .select({
          id: budgetCategoriesTable.id,
          name: budgetCategoriesTable.name,
          spendingLimitPaise: budgetCategoriesTable.spendingLimitPaise,
          isEssential: budgetCategoriesTable.isEssential,
        })
        .from(budgetCategoriesTable)
        .where(eq(budgetCategoriesTable.userId, userId))
        .orderBy(asc(budgetCategoriesTable.name)),
    ]);
  const savingsContributionsPaise = contributions.reduce(
    (total, contribution) => total + contribution.amountPaise,
    0,
  );
  const financeInput: FinanceInput = {
    profile: {
      challengeStartDate: profile.challengeStartDate,
      challengeDurationDays: profile.challengeDurationDays,
      startingBudgetPaise: profile.startingBudgetPaise,
      plannedIncomePaise: profile.plannedIncomePaise,
      dailyDiscretionaryTargetPaise: profile.dailyDiscretionaryTargetPaise,
      savingsGoalPaise: profile.savingsGoalPaise,
      emergencyReserveTargetPaise: profile.emergencyReserveTargetPaise,
      timezone: user.timezone,
    },
    transactions: transactions.map((transaction) => ({
      type: transaction.transactionType,
      amountPaise: transaction.amountPaise,
      category: transaction.category,
      transactionDate: transaction.transactionDate,
      isEssential: transaction.isEssential,
    })),
    commitments: commitments.map((commitment) => ({
      name: commitment.name,
      category: commitment.category,
      amountPaise: commitment.amountPaise,
      dueDate: commitment.dueDate,
      recurrenceType: commitment.recurrenceType,
      isEssential: commitment.isEssential,
      status: commitment.status,
    })),
    subscriptions: subscriptions.map((subscription) => ({
      name: subscription.name,
      category: subscription.category,
      amountPaise: subscription.amountPaise,
      billingFrequency: subscription.billingFrequency,
      nextBillingDate: subscription.nextBillingDate,
      status: subscription.status,
    })),
    savingsContributionsPaise,
  };
  return {
    user,
    profile,
    financeInput,
    transactions,
    commitments,
    subscriptions,
    goals,
    contributions,
    categories,
    savingsContributionsPaise,
  };
}

export async function getDashboard(userId: string) {
  const state = await loadFinanceData(userId);
  const calculations = calculateFinance(state.financeInput);
  const latestTransactionRows = state.transactions.slice(0, 5);
  const today = localDateInTimezone(state.user.timezone);
  const upcoming = state.commitments
    .filter((commitment) => commitment.status === "planned" && commitment.dueDate >= today)
    .slice(0, 5);
  const paidTransactionIds = new Map<number, number>();
  for (const row of state.transactions) {
    if (row.commitmentId !== null) paidTransactionIds.set(row.commitmentId, row.id);
  }
  const grouped = new Map<string, number>();
  for (const row of state.transactions) {
    if (row.transactionType === "expense") {
      grouped.set(row.category, (grouped.get(row.category) ?? 0) + row.amountPaise);
    }
  }
  return {
    profile: toProfile(state.user, state.profile),
    snapshot: calculations.snapshot,
    incomePaise: calculations.incomePaise,
    expensesPaise: calculations.expensesPaise,
    daysRemaining: calculations.daysRemaining,
    savingsTargetPaise: calculations.savingsTargetPaise,
    upcomingCommitments: upcoming.map((row) =>
      toCommitment(row, paidTransactionIds.get(row.id) ?? null),
    ),
    recentTransactions: latestTransactionRows.map(toTransaction),
    forecast: calculations.forecast,
    categorySpending: [...grouped.entries()]
      .map(([category, amountPaise]) => ({ category, amountPaise }))
      .sort((left, right) => right.amountPaise - left.amountPaise),
    insights: calculations.insights,
  };
}

export async function getSavingsGoals(userId: string) {
  const state = await loadFinanceData(userId);
  const totals = new Map<number, number>();
  for (const contribution of state.contributions) {
    totals.set(
      contribution.goalId,
      (totals.get(contribution.goalId) ?? 0) + contribution.amountPaise,
    );
  }
  return state.goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetAmountPaise: goal.targetAmountPaise,
    targetDate: goal.targetDate,
    currentContributionPaise: totals.get(goal.id) ?? 0,
    createdAt: goal.createdAt.toISOString(),
  }));
}

export async function getBudgetCategories(userId: string) {
  const [categories, transactions] = await Promise.all([
    db
      .select()
      .from(budgetCategoriesTable)
      .where(eq(budgetCategoriesTable.userId, userId))
      .orderBy(asc(budgetCategoriesTable.name)),
    db
      .select({
        category: transactionsTable.category,
        amountPaise: transactionsTable.amountPaise,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.transactionType, "expense"),
        ),
      ),
  ]);
  const spent = new Map<string, number>();
  for (const row of transactions) {
    spent.set(row.category, (spent.get(row.category) ?? 0) + row.amountPaise);
  }
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    spendingLimitPaise: category.spendingLimitPaise,
    isEssential: category.isEssential,
    spentPaise: spent.get(category.name) ?? 0,
  }));
}

export async function writeAuditEvent(
  userId: string,
  eventType: string,
  entityType: string,
  entityId?: number | string | null,
  metadata: Record<string, unknown> = {},
) {
  await db.execute(sql`
    INSERT INTO finsync_audit_events (user_id, event_type, entity_type, entity_id, safe_metadata)
    VALUES (${userId}, ${eventType}, ${entityType}, ${entityId == null ? null : String(entityId)}, ${JSON.stringify(metadata)}::jsonb)
  `);
}
