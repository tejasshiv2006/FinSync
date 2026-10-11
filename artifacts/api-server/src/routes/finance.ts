import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { Router } from "express";
import {
  budgetCategoriesTable,
  commitmentsTable,
  db,
  financialProfilesTable,
  notificationsTable,
  savingsContributionsTable,
  savingsGoalsTable,
  subscriptionsTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateBudgetCategoryBody,
  CreateBudgetCategoryResponse,
  CreateCommitmentBody,
  CreateCommitmentResponse,
  CreateSavingsContributionBody,
  CreateSavingsContributionParams,
  CreateSavingsContributionResponse,
  CreateSavingsGoalBody,
  CreateSavingsGoalResponse,
  CreateSubscriptionBody,
  CreateSubscriptionResponse,
  CreateTransactionBody,
  CreateTransactionResponse,
  DeleteBudgetCategoryParams,
  DeleteBudgetCategoryResponse,
  DeleteTransactionParams,
  DeleteTransactionResponse,
  ExportFinancialDataResponse,
  GetDashboardResponse,
  GetProfileResponse,
  ListBudgetCategoriesResponse,
  ListCommitmentsResponse,
  ListNotificationsResponse,
  ListSavingsGoalsResponse,
  ListSubscriptionsResponse,
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  PayCommitmentParams,
  PayCommitmentResponse,
  UpdateBudgetCategoryBody,
  UpdateBudgetCategoryParams,
  UpdateBudgetCategoryResponse,
  UpdateCommitmentBody,
  UpdateCommitmentParams,
  UpdateCommitmentResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  UpdateSavingsGoalBody,
  UpdateSavingsGoalParams,
  UpdateSavingsGoalResponse,
  UpdateSubscriptionBody,
  UpdateSubscriptionParams,
  UpdateSubscriptionResponse,
  UpdateTransactionBody,
  UpdateTransactionParams,
  UpdateTransactionResponse,
  CreateSavingsContributionResponse as ContributionResponse,
} from "@workspace/api-zod";
import { auditEventsTable } from "@workspace/db";
import {
  calculateFinance,
  localDateInTimezone,
  type FinanceInput,
} from "../lib/finance-engine";
import {
  getBudgetCategories,
  getDashboard,
  getSavingsGoals,
  ensureProfile,
  loadFinanceData,
  toCommitment,
  toProfile,
  toSubscription,
  toTransaction,
  userIdFromRequest,
  writeAuditEvent,
} from "../lib/finance-data";
import {
  rateLimitFinancialMutations,
  requireAuth,
  requireSameOriginForMutations,
} from "../middlewares/financeSecurity";

const router = Router();
router.use(requireAuth, requireSameOriginForMutations, rateLimitFinancialMutations);

function userId(request: Parameters<typeof userIdFromRequest>[0]): string {
  const id = userIdFromRequest(request);
  if (!id) throw new Error("Authenticated user id is missing.");
  return id;
}

function invalid(response: import("express").Response) {
  response.status(400).json({ error: "The submitted information is invalid." });
}

function notFound(response: import("express").Response) {
  response.status(404).json({ error: "That record was not found." });
}

function conflict(response: import("express").Response, message: string) {
  response.status(409).json({ error: message });
}

function paidTransactionMap(rows: Array<typeof transactionsTable.$inferSelect>) {
  const result = new Map<number, number>();
  for (const row of rows) {
    if (row.commitmentId !== null) result.set(row.commitmentId, row.id);
  }
  return result;
}

router.get("/profile", async (request, response) => {
  const { user, profile } = await ensureProfile(userId(request));
  response.json(GetProfileResponse.parse(toProfile(user, profile)));
});

router.patch("/profile", async (request, response) => {
  const parsed = UpdateProfileBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const body = parsed.data;
  if (body.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
    } catch {
      return invalid(response);
    }
  }
  await ensureProfile(id);
  await db.transaction(async (transaction) => {
    const userPatch: Partial<typeof usersTable.$inferInsert> = {};
    if (body.displayName !== undefined) userPatch.displayName = body.displayName;
    if (body.timezone !== undefined) userPatch.timezone = body.timezone;
    if (Object.keys(userPatch).length) {
      await transaction.update(usersTable).set(userPatch).where(eq(usersTable.id, id));
    }
    const profilePatch: Partial<typeof financialProfilesTable.$inferInsert> = {};
    if (body.challengeStartDate !== undefined) {
      profilePatch.challengeStartDate = body.challengeStartDate.toISOString().slice(0, 10);
    }
    if (body.challengeDurationDays !== undefined) {
      profilePatch.challengeDurationDays = body.challengeDurationDays;
    }
    if (body.startingBudgetPaise !== undefined) {
      profilePatch.startingBudgetPaise = body.startingBudgetPaise;
    }
    if (body.plannedIncomePaise !== undefined) {
      profilePatch.plannedIncomePaise = body.plannedIncomePaise;
    }
    if (body.dailyDiscretionaryTargetPaise !== undefined) {
      profilePatch.dailyDiscretionaryTargetPaise = body.dailyDiscretionaryTargetPaise;
    }
    if (body.savingsGoalPaise !== undefined) {
      profilePatch.savingsGoalPaise = body.savingsGoalPaise;
    }
    if (body.emergencyReserveTargetPaise !== undefined) {
      profilePatch.emergencyReserveTargetPaise = body.emergencyReserveTargetPaise;
    }
    if (body.onboardingCompleted !== undefined) {
      profilePatch.onboardingCompleted = body.onboardingCompleted;
    }
    if (Object.keys(profilePatch).length) {
      await transaction
        .update(financialProfilesTable)
        .set(profilePatch)
        .where(eq(financialProfilesTable.userId, id));
    }
  });
  await writeAuditEvent(id, "profile.updated", "profile");
  const refreshed = await ensureProfile(id);
  response.json(UpdateProfileResponse.parse(toProfile(refreshed.user, refreshed.profile)));
});

router.get("/dashboard", async (request, response) => {
  response.json(GetDashboardResponse.parse(await getDashboard(userId(request))));
});

router.get("/transactions", async (request, response) => {
  const parsed = ListTransactionsQueryParams.safeParse(request.query);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const query = parsed.data;
  const conditions = [eq(transactionsTable.userId, id)];
  if (query.type) conditions.push(eq(transactionsTable.transactionType, query.type));
  if (query.category) conditions.push(eq(transactionsTable.category, query.category));
  if (query.from) conditions.push(gte(transactionsTable.transactionDate, query.from.toISOString().slice(0, 10)));
  if (query.to) conditions.push(lte(transactionsTable.transactionDate, query.to.toISOString().slice(0, 10)));
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_]/g, "\\$&")}%`;
    const searchFilter = or(
      ilike(transactionsTable.description, pattern),
      ilike(transactionsTable.category, pattern),
    );
    if (searchFilter) conditions.push(searchFilter);
  }
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.transactionDate), desc(transactionsTable.createdAt))
    .limit(query.limit ?? 50)
    .offset(query.offset ?? 0);
  response.json(ListTransactionsResponse.parse(rows.map(toTransaction)));
});

router.post("/transactions", async (request, response) => {
  const parsed = CreateTransactionBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const body = parsed.data;
  const [row] = await db
    .insert(transactionsTable)
    .values({
      userId: id,
      transactionType: body.type,
      amountPaise: body.amountPaise,
      category: body.category.trim(),
      description: body.description?.trim() ?? "",
      transactionDate: body.transactionDate.toISOString().slice(0, 10),
      isEssential: body.isEssential ?? false,
    })
    .returning();
  await writeAuditEvent(id, "transaction.created", "transaction", row.id, {
    type: row.transactionType,
    amountPaise: row.amountPaise,
  });
  response.status(201).json(CreateTransactionResponse.parse(toTransaction(row)));
});

router.patch("/transactions/:id", async (request, response) => {
  const params = UpdateTransactionParams.safeParse(request.params);
  const parsed = UpdateTransactionBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const id = userId(request);
  const body = parsed.data;
  const patch: Partial<typeof transactionsTable.$inferInsert> = {};
  if (body.type !== undefined) patch.transactionType = body.type;
  if (body.amountPaise !== undefined) patch.amountPaise = body.amountPaise;
  if (body.category !== undefined) patch.category = body.category.trim();
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.transactionDate !== undefined) {
    patch.transactionDate = body.transactionDate.toISOString().slice(0, 10);
  }
  if (body.isEssential !== undefined) patch.isEssential = body.isEssential;
  const [row] = await db
    .update(transactionsTable)
    .set(patch)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, id)))
    .returning();
  if (!row) return notFound(response);
  await writeAuditEvent(id, "transaction.updated", "transaction", row.id);
  response.json(UpdateTransactionResponse.parse(toTransaction(row)));
});

router.delete("/transactions/:id", async (request, response) => {
  const params = DeleteTransactionParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .delete(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, id)))
    .returning({ id: transactionsTable.id });
  if (!row) return notFound(response);
  await writeAuditEvent(id, "transaction.deleted", "transaction", row.id);
  response.sendStatus(204);
});

router.get("/budget/categories", async (request, response) => {
  response.json(ListBudgetCategoriesResponse.parse(await getBudgetCategories(userId(request))));
});

router.post("/budget/categories", async (request, response) => {
  const parsed = CreateBudgetCategoryBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .insert(budgetCategoriesTable)
    .values({
      userId: id,
      name: parsed.data.name.trim(),
      spendingLimitPaise: parsed.data.spendingLimitPaise,
      isEssential: parsed.data.isEssential ?? false,
    })
    .returning();
  await writeAuditEvent(id, "budget_category.created", "budget_category", row.id);
  const categories = await getBudgetCategories(id);
  response.status(201).json(CreateBudgetCategoryResponse.parse(categories.find((item) => item.id === row.id)));
});

router.patch("/budget/categories/:id", async (request, response) => {
  const params = UpdateBudgetCategoryParams.safeParse(request.params);
  const parsed = UpdateBudgetCategoryBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const body = parsed.data;
  const patch: Partial<typeof budgetCategoriesTable.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.spendingLimitPaise !== undefined) patch.spendingLimitPaise = body.spendingLimitPaise;
  if (body.isEssential !== undefined) patch.isEssential = body.isEssential;
  const id = userId(request);
  const [row] = await db
    .update(budgetCategoriesTable)
    .set(patch)
    .where(and(eq(budgetCategoriesTable.id, params.data.id), eq(budgetCategoriesTable.userId, id)))
    .returning();
  if (!row) return notFound(response);
  await writeAuditEvent(id, "budget_category.updated", "budget_category", row.id);
  const categories = await getBudgetCategories(id);
  response.json(UpdateBudgetCategoryResponse.parse(categories.find((item) => item.id === row.id)));
});

router.delete("/budget/categories/:id", async (request, response) => {
  const params = DeleteBudgetCategoryParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .delete(budgetCategoriesTable)
    .where(and(eq(budgetCategoriesTable.id, params.data.id), eq(budgetCategoriesTable.userId, id)))
    .returning({ id: budgetCategoriesTable.id });
  if (!row) return notFound(response);
  await writeAuditEvent(id, "budget_category.deleted", "budget_category", row.id);
  response.sendStatus(204);
});

router.get("/savings-goals", async (request, response) => {
  response.json(ListSavingsGoalsResponse.parse(await getSavingsGoals(userId(request))));
});

router.post("/savings-goals", async (request, response) => {
  const parsed = CreateSavingsGoalBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .insert(savingsGoalsTable)
    .values({
      userId: id,
      name: parsed.data.name.trim(),
      targetAmountPaise: parsed.data.targetAmountPaise,
      targetDate: parsed.data.targetDate?.toISOString().slice(0, 10) ?? null,
    })
    .returning();
  await writeAuditEvent(id, "savings_goal.created", "savings_goal", row.id);
  const goals = await getSavingsGoals(id);
  response.status(201).json(CreateSavingsGoalResponse.parse(goals.find((goal) => goal.id === row.id)));
});

router.patch("/savings-goals/:id", async (request, response) => {
  const params = UpdateSavingsGoalParams.safeParse(request.params);
  const parsed = UpdateSavingsGoalBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const body = parsed.data;
  const patch: Partial<typeof savingsGoalsTable.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.targetAmountPaise !== undefined) patch.targetAmountPaise = body.targetAmountPaise;
  if (body.targetDate !== undefined) patch.targetDate = body.targetDate?.toISOString().slice(0, 10) ?? null;
  const id = userId(request);
  const [row] = await db
    .update(savingsGoalsTable)
    .set(patch)
    .where(and(eq(savingsGoalsTable.id, params.data.id), eq(savingsGoalsTable.userId, id)))
    .returning({ id: savingsGoalsTable.id });
  if (!row) return notFound(response);
  await writeAuditEvent(id, "savings_goal.updated", "savings_goal", row.id);
  const goals = await getSavingsGoals(id);
  response.json(UpdateSavingsGoalResponse.parse(goals.find((goal) => goal.id === row.id)));
});

router.post("/savings-goals/:id/contributions", async (request, response) => {
  const params = CreateSavingsContributionParams.safeParse(request.params);
  const parsed = CreateSavingsContributionBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const id = userId(request);
  const [goal] = await db
    .select({ id: savingsGoalsTable.id })
    .from(savingsGoalsTable)
    .where(and(eq(savingsGoalsTable.id, params.data.id), eq(savingsGoalsTable.userId, id)))
    .limit(1);
  if (!goal) return notFound(response);
  await db.insert(savingsContributionsTable).values({
    userId: id,
    goalId: goal.id,
    amountPaise: parsed.data.amountPaise,
    contributionDate: parsed.data.contributionDate.toISOString().slice(0, 10),
    note: parsed.data.note?.trim() ?? "",
  });
  await writeAuditEvent(id, "savings_contribution.created", "savings_goal", goal.id, {
    amountPaise: parsed.data.amountPaise,
  });
  const goals = await getSavingsGoals(id);
  response.status(201).json(
    ContributionResponse.parse(goals.find((item) => item.id === goal.id)),
  );
});

router.get("/commitments", async (request, response) => {
  const id = userId(request);
  const [rows, transactions] = await Promise.all([
    db
      .select()
      .from(commitmentsTable)
      .where(eq(commitmentsTable.userId, id))
      .orderBy(asc(commitmentsTable.dueDate)),
    db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, id)),
  ]);
  const paymentIds = paidTransactionMap(transactions);
  response.json(
    ListCommitmentsResponse.parse(
      rows.map((row) => toCommitment(row, paymentIds.get(row.id) ?? null)),
    ),
  );
});

router.post("/commitments", async (request, response) => {
  const parsed = CreateCommitmentBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .insert(commitmentsTable)
    .values({
      userId: id,
      name: parsed.data.name.trim(),
      category: parsed.data.category.trim(),
      amountPaise: parsed.data.amountPaise,
      dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
      recurrenceType: parsed.data.recurrenceType,
      isEssential: parsed.data.isEssential,
    })
    .returning();
  await writeAuditEvent(id, "commitment.created", "commitment", row.id);
  response.status(201).json(CreateCommitmentResponse.parse(toCommitment(row)));
});

router.patch("/commitments/:id", async (request, response) => {
  const params = UpdateCommitmentParams.safeParse(request.params);
  const parsed = UpdateCommitmentBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const body = parsed.data;
  const patch: Partial<typeof commitmentsTable.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.category !== undefined) patch.category = body.category.trim();
  if (body.amountPaise !== undefined) patch.amountPaise = body.amountPaise;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate.toISOString().slice(0, 10);
  if (body.recurrenceType !== undefined) patch.recurrenceType = body.recurrenceType;
  if (body.isEssential !== undefined) patch.isEssential = body.isEssential;
  if (body.status !== undefined) patch.status = body.status;
  const id = userId(request);
  const [row] = await db
    .update(commitmentsTable)
    .set(patch)
    .where(and(eq(commitmentsTable.id, params.data.id), eq(commitmentsTable.userId, id)))
    .returning();
  if (!row) return notFound(response);
  await writeAuditEvent(id, "commitment.updated", "commitment", row.id);
  const [payment] = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(eq(transactionsTable.commitmentId, row.id))
    .limit(1);
  response.json(UpdateCommitmentResponse.parse(toCommitment(row, payment?.id ?? null)));
});

router.post("/commitments/:id/pay", async (request, response) => {
  const params = PayCommitmentParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const id = userId(request);
  const result = await db.transaction(async (transaction) => {
    const [commitment] = await transaction
      .select()
      .from(commitmentsTable)
      .where(
        and(
          eq(commitmentsTable.id, params.data.id),
          eq(commitmentsTable.userId, id),
        ),
      )
      .for("update")
      .limit(1);
    if (!commitment) return { kind: "not_found" as const };
    const [existingPayment] = await transaction
      .select({ id: transactionsTable.id })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.commitmentId, commitment.id),
          eq(transactionsTable.userId, id),
        ),
      )
      .limit(1);
    if (existingPayment) {
      if (commitment.status !== "paid") {
        await transaction
          .update(commitmentsTable)
          .set({ status: "paid" })
          .where(eq(commitmentsTable.id, commitment.id));
      }
      return {
        kind: "paid" as const,
        commitment: { ...commitment, status: "paid" as const },
        transactionId: existingPayment.id,
        alreadyPaid: true,
      };
    }
    if (commitment.status !== "planned") {
      return { kind: "not_payable" as const };
    }
    const { timezone } = (await ensureProfile(id)).user;
    const [payment] = await transaction
      .insert(transactionsTable)
      .values({
        userId: id,
        transactionType: "expense",
        amountPaise: commitment.amountPaise,
        category: commitment.category,
        description: `Paid commitment: ${commitment.name}`,
        transactionDate: localDateInTimezone(timezone),
        isEssential: commitment.isEssential,
        commitmentId: commitment.id,
      })
      .returning();
    const [updated] = await transaction
      .update(commitmentsTable)
      .set({ status: "paid" })
      .where(eq(commitmentsTable.id, commitment.id))
      .returning();
    await transaction.insert(auditEventsTable).values({
      userId: id,
      eventType: "commitment.paid",
      entityType: "commitment",
      entityId: String(commitment.id),
      safeMetadata: { transactionId: payment.id, amountPaise: payment.amountPaise },
    });
    return {
      kind: "paid" as const,
      commitment: updated,
      transactionId: payment.id,
      alreadyPaid: false,
    };
  });
  if (result.kind === "not_found") return notFound(response);
  if (result.kind === "not_payable") {
    return conflict(response, "Only a planned commitment can be marked as paid.");
  }
  response.json(
    PayCommitmentResponse.parse(toCommitment(result.commitment, result.transactionId)),
  );
});

router.get("/subscriptions", async (request, response) => {
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId(request)))
    .orderBy(asc(subscriptionsTable.nextBillingDate));
  response.json(ListSubscriptionsResponse.parse(rows.map(toSubscription)));
});

router.post("/subscriptions", async (request, response) => {
  const parsed = CreateSubscriptionBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .insert(subscriptionsTable)
    .values({
      userId: id,
      name: parsed.data.name.trim(),
      amountPaise: parsed.data.amountPaise,
      billingFrequency: parsed.data.billingFrequency,
      nextBillingDate: parsed.data.nextBillingDate.toISOString().slice(0, 10),
      category: parsed.data.category.trim(),
      status: "active",
    })
    .returning();
  await writeAuditEvent(id, "subscription.created", "subscription", row.id);
  response.status(201).json(CreateSubscriptionResponse.parse(toSubscription(row)));
});

router.patch("/subscriptions/:id", async (request, response) => {
  const params = UpdateSubscriptionParams.safeParse(request.params);
  const parsed = UpdateSubscriptionBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const body = parsed.data;
  const patch: Partial<typeof subscriptionsTable.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.amountPaise !== undefined) patch.amountPaise = body.amountPaise;
  if (body.billingFrequency !== undefined) patch.billingFrequency = body.billingFrequency;
  if (body.nextBillingDate !== undefined) {
    patch.nextBillingDate = body.nextBillingDate.toISOString().slice(0, 10);
  }
  if (body.category !== undefined) patch.category = body.category.trim();
  if (body.status !== undefined) patch.status = body.status;
  const id = userId(request);
  const [row] = await db
    .update(subscriptionsTable)
    .set(patch)
    .where(and(eq(subscriptionsTable.id, params.data.id), eq(subscriptionsTable.userId, id)))
    .returning();
  if (!row) return notFound(response);
  await writeAuditEvent(id, "subscription.updated", "subscription", row.id);
  response.json(UpdateSubscriptionResponse.parse(toSubscription(row)));
});

router.get("/notifications", async (request, response) => {
  const id = userId(request);
  const [state, userAndProfile] = await Promise.all([
    loadFinanceData(id),
    ensureProfile(id),
  ]);
  const calculation = calculateFinance(state.financeInput);
  const today = localDateInTimezone(userAndProfile.user.timezone);
  for (const [index, message] of calculation.snapshot.riskFactors.entries()) {
    await db
      .insert(notificationsTable)
      .values({
        userId: id,
        notificationType: "risk",
        title: calculation.snapshot.risk === "critical" ? "Action needed" : "Plan update",
        message,
        severity:
          calculation.snapshot.risk === "critical"
            ? "critical"
            : calculation.snapshot.risk === "low"
              ? "info"
              : "warning",
        dedupeKey: `risk:${today}:${index}:${message.slice(0, 40)}`,
      })
      .onConflictDoNothing();
  }
  for (const commitment of state.commitments) {
    if (
      commitment.status === "planned" &&
      commitment.dueDate >= today &&
      commitment.dueDate <= addDate(today, 3)
    ) {
      await db
        .insert(notificationsTable)
        .values({
          userId: id,
          notificationType: "commitment",
          title: "Commitment coming up",
          message: `${commitment.name} is due ${commitment.dueDate}.`,
          severity: "warning",
          dedupeKey: `commitment:${commitment.id}:${commitment.dueDate}`,
        })
        .onConflictDoNothing();
    }
  }
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, id))
    .orderBy(desc(notificationsTable.createdAt));
  response.json(
    ListNotificationsResponse.parse(
      rows.map((row) => ({
        id: row.id,
        type: row.notificationType,
        title: row.title,
        message: row.message,
        severity: row.severity as "info" | "warning" | "critical",
        isRead: row.isRead,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

function addDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

router.post("/notifications/:id/read", async (request, response) => {
  const params = MarkNotificationReadParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const [row] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, params.data.id),
        eq(notificationsTable.userId, userId(request)),
      ),
    )
    .returning();
  if (!row) return notFound(response);
  response.json(
    MarkNotificationReadResponse.parse({
      id: row.id,
      type: row.notificationType,
      title: row.title,
      message: row.message,
      severity: row.severity,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    }),
  );
});

router.get("/export", async (request, response) => {
  const id = userId(request);
  const state = await loadFinanceData(id);
  const paidIds = paidTransactionMap(state.transactions);
  const goals = await getSavingsGoals(id);
  response.json(
    ExportFinancialDataResponse.parse({
      profile: toProfile(state.user, state.profile),
      transactions: state.transactions.map(toTransaction),
      goals,
      commitments: state.commitments.map((row) =>
        toCommitment(row, paidIds.get(row.id) ?? null),
      ),
      subscriptions: state.subscriptions.map(toSubscription),
    }),
  );
});

export default router;

