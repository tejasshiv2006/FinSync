import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import {
  ApplyScenarioParams,
  ApplyScenarioResponse,
  DeleteScenarioParams,
  DeleteScenarioResponse,
  ListScenariosResponse,
  SaveScenarioBody,
  SaveScenarioResponse,
  SimulateScenarioBody,
  SimulateScenarioResponse,
  UpdateScenarioBody,
  UpdateScenarioParams,
  UpdateScenarioResponse,
} from "@workspace/api-zod";
import {
  auditEventsTable,
  commitmentsTable,
  db,
  financialProfilesTable,
  savingsContributionsTable,
  savingsGoalsTable,
  scenariosTable,
  subscriptionsTable,
  transactionsTable,
} from "@workspace/db";
import {
  calculateFinance,
  localDateInTimezone,
  type FinanceInput,
} from "../lib/finance-engine";
import {
  loadFinanceData,
  userIdFromRequest,
} from "../lib/finance-data";
import {
  rateLimitFinancialMutations,
  requireAuth,
  requireSameOriginForMutations,
} from "../middlewares/financeSecurity";

const router = Router();
router.use(requireAuth, requireSameOriginForMutations, rateLimitFinancialMutations);

function userId(request: { userId?: string }): string {
  if (!request.userId) throw new Error("Authenticated user id is missing.");
  return request.userId;
}

function invalid(response: import("express").Response) {
  response.status(400).json({ error: "The submitted information is invalid." });
}

function notFound(response: import("express").Response) {
  response.status(404).json({ error: "That scenario was not found." });
}

function conflict(response: import("express").Response, message: string) {
  response.status(409).json({ error: message });
}

type ScenarioAssumptions = ReturnType<typeof SaveScenarioBody.parse>;

function getScenarioResult(input: FinanceInput, assumptions: ScenarioAssumptions) {
  const baseline = calculateFinance(input).snapshot;
  const projectedInput: FinanceInput = {
    ...input,
    transactions: [...input.transactions],
    commitments: [...input.commitments],
    subscriptions: [...input.subscriptions],
  };
  const today = localDateInTimezone(input.profile.timezone);
  const decisionDate = assumptions.decisionDate.toISOString().slice(0, 10);
  const category = assumptions.category?.trim() || "Other";
  const description = assumptions.description?.trim() || assumptions.name;
  const isFuture = decisionDate > today;
  const explanation: string[] = [];

  switch (assumptions.type) {
    case "purchase":
    case "unexpected_expense":
      if (isFuture) {
        projectedInput.commitments.push({
          name: assumptions.name,
          category,
          amountPaise: assumptions.amountPaise,
          dueDate: decisionDate,
          recurrenceType: "once",
          isEssential: assumptions.isEssential,
          status: "planned",
        });
        explanation.push("The future purchase is modeled as a planned one-time commitment.");
      } else {
        projectedInput.transactions.push({
          type: "expense",
          amountPaise: assumptions.amountPaise,
          category,
          transactionDate: decisionDate,
          isEssential: assumptions.isEssential,
        });
        explanation.push("The purchase is modeled as an expense on its decision date.");
      }
      break;
    case "income":
      if (isFuture) {
        projectedInput.profile = {
          ...projectedInput.profile,
          plannedIncomePaise:
            projectedInput.profile.plannedIncomePaise + assumptions.amountPaise,
        };
        explanation.push("Future income is included in the forecast, not in today's balance.");
      } else {
        projectedInput.transactions.push({
          type: "income",
          amountPaise: assumptions.amountPaise,
          category,
          transactionDate: decisionDate,
          isEssential: false,
        });
        explanation.push("The income is added to the recorded balance on its decision date.");
      }
      break;
    case "new_subscription":
      projectedInput.subscriptions.push({
        name: assumptions.name,
        category,
        amountPaise: assumptions.amountPaise,
        billingFrequency: assumptions.billingFrequency ?? "monthly",
        nextBillingDate: decisionDate,
        status: "active",
      });
      explanation.push("Recurring charges are included through the end of the challenge.");
      break;
    case "cancel_subscription":
      if (!assumptions.subscriptionId) {
        throw new Error("Choose a subscription before simulating its cancellation.");
      }
      projectedInput.subscriptions = projectedInput.subscriptions.filter(
        (_subscription, index) => index !== -1,
      );
      // The input list and database list have the same order only when mapped here by index.
      // The selected subscription is removed by its same-owner record's name and next billing
      // date in the caller before this calculation when an id is supplied.
      explanation.push("The selected subscription's future recurring charges are removed.");
      break;
    case "savings_contribution":
      projectedInput.savingsContributionsPaise += assumptions.amountPaise;
      explanation.push("The contribution is earmarked savings, not counted as an expense.");
      break;
    case "discretionary_change":
      projectedInput.dailyDiscretionaryOverridePaise = assumptions.amountPaise;
      explanation.push("The daily discretionary amount is used for each remaining challenge day.");
      break;
    case "delayed_purchase":
      projectedInput.commitments.push({
        name: assumptions.name,
        category,
        amountPaise: assumptions.amountPaise,
        dueDate: decisionDate,
        recurrenceType: "once",
        isEssential: assumptions.isEssential,
        status: "planned",
      });
      explanation.push("The delayed purchase is kept as a planned one-time commitment.");
      break;
  }

  const projected = calculateFinance(projectedInput).snapshot;
  explanation.push(
    `Projected challenge-end balance ${projected.projectedMonthEndBalancePaise >= baseline.projectedMonthEndBalancePaise ? "increases" : "decreases"} by ₹${Math.abs(projected.projectedMonthEndBalancePaise - baseline.projectedMonthEndBalancePaise) / 100}.`,
  );
  return {
    baseline,
    projected,
    changePaise:
      projected.projectedMonthEndBalancePaise -
      baseline.projectedMonthEndBalancePaise,
    explanation,
  };
}

async function projectScenarioForUser(
  userId: string,
  assumptions: ScenarioAssumptions,
) {
  const data = await loadFinanceData(userId);
  const input = data.financeInput;
  if (assumptions.type === "cancel_subscription") {
    if (!assumptions.subscriptionId) {
      throw new Error("Choose a subscription before simulating its cancellation.");
    }
    const subscription = data.subscriptions.find(
      (candidate) => candidate.id === assumptions.subscriptionId,
    );
    if (!subscription) throw new Error("The selected subscription was not found.");
    input.subscriptions = input.subscriptions.filter(
      (_item, index) => data.subscriptions[index]?.id !== subscription.id,
    );
  }
  if (assumptions.type === "savings_contribution" && assumptions.goalId) {
    const goal = data.goals.find((candidate) => candidate.id === assumptions.goalId);
    if (!goal) throw new Error("The selected savings goal was not found.");
  }
  return getScenarioResult(input, assumptions);
}

function scenarioResponse(row: typeof scenariosTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.scenarioType,
    assumptions: row.scenarioData,
    result: row.projectedResults,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/scenarios", async (request, response) => {
  const rows = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.userId, userId(request)))
    .orderBy(desc(scenariosTable.createdAt));
  response.json(ListScenariosResponse.parse(rows.map(scenarioResponse)));
});

router.post("/scenarios/simulate", async (request, response) => {
  const parsed = SimulateScenarioBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  try {
    const result = await projectScenarioForUser(id, parsed.data);
    response.json(SimulateScenarioResponse.parse(result));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "The scenario could not be simulated.",
    });
  }
});

router.post("/scenarios", async (request, response) => {
  const parsed = SaveScenarioBody.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  const id = userId(request);
  let result;
  try {
    result = await projectScenarioForUser(id, parsed.data);
  } catch (error) {
    return response.status(400).json({
      error: error instanceof Error ? error.message : "The scenario could not be saved.",
    });
  }
  const [row] = await db
    .insert(scenariosTable)
    .values({
      userId: id,
      name: parsed.data.name,
      scenarioType: parsed.data.type,
      scenarioData: parsed.data,
      baselineSnapshot: result.baseline,
      projectedResults: result,
    })
    .returning();
  await db.insert(auditEventsTable).values({
    userId: id,
    eventType: "scenario.saved",
    entityType: "scenario",
    entityId: String(row.id),
    safeMetadata: { type: row.scenarioType },
  });
  response.status(201).json(SaveScenarioResponse.parse(scenarioResponse(row)));
});

router.patch("/scenarios/:id", async (request, response) => {
  const params = UpdateScenarioParams.safeParse(request.params);
  const parsed = UpdateScenarioBody.safeParse(request.body);
  if (!params.success || !parsed.success) return invalid(response);
  const id = userId(request);
  const [existing] = await db
    .select()
    .from(scenariosTable)
    .where(
      and(
        eq(scenariosTable.id, params.data.id),
        eq(scenariosTable.userId, id),
      ),
    )
    .limit(1);
  if (!existing) return notFound(response);
  if (existing.status === "applied") {
    return conflict(response, "An applied scenario cannot be changed.");
  }
  const name = parsed.data.name ?? existing.name;
  const [row] = await db
    .update(scenariosTable)
    .set({
      name,
      scenarioData: { ...existing.scenarioData, name },
    })
    .where(and(eq(scenariosTable.id, existing.id), eq(scenariosTable.userId, id)))
    .returning();
  response.json(UpdateScenarioResponse.parse(scenarioResponse(row)));
});

router.delete("/scenarios/:id", async (request, response) => {
  const params = DeleteScenarioParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const id = userId(request);
  const [row] = await db
    .delete(scenariosTable)
    .where(
      and(
        eq(scenariosTable.id, params.data.id),
        eq(scenariosTable.userId, id),
      ),
    )
    .returning({ id: scenariosTable.id });
  if (!row) return notFound(response);
  response.sendStatus(204);
});

router.post("/scenarios/:id/apply", async (request, response) => {
  const params = ApplyScenarioParams.safeParse(request.params);
  if (!params.success) return invalid(response);
  const id = userId(request);
  const result = await db.transaction(async (transaction) => {
    const [scenario] = await transaction
      .select()
      .from(scenariosTable)
      .where(
        and(
          eq(scenariosTable.id, params.data.id),
          eq(scenariosTable.userId, id),
        ),
      )
      .for("update")
      .limit(1);
    if (!scenario) return { kind: "not_found" as const };
    const existingData = scenario.scenarioData as Record<string, unknown>;
    const savedApplied = existingData.appliedIds as
      | {
          transactionId: number | null;
          commitmentId: number | null;
          subscriptionId: number | null;
          goalId: number | null;
          message: string;
        }
      | undefined;
    if (scenario.status === "applied" && savedApplied) {
      return { kind: "applied" as const, id: scenario.id, ...savedApplied };
    }
    if (scenario.status === "applied") return { kind: "already_applied" as const };
    const assumptions = SaveScenarioBody.safeParse(existingData);
    if (!assumptions.success) return { kind: "invalid_saved_scenario" as const };
    const a = assumptions.data;
    const decisionDate = a.decisionDate.toISOString().slice(0, 10);
    const today = localDateInTimezone((await loadFinanceData(id)).user.timezone);
    let transactionId: number | null = null;
    let commitmentId: number | null = null;
    let subscriptionId: number | null = null;
    let goalId: number | null = null;
    let message = "Scenario applied to your saved financial plan.";
    const category = a.category?.trim() || "Other";
    const description = a.description?.trim() || a.name;

    if (a.type === "purchase" || a.type === "unexpected_expense") {
      if (decisionDate > today) {
        const [commitment] = await transaction
          .insert(commitmentsTable)
          .values({
            userId: id,
            name: a.name,
            category,
            amountPaise: a.amountPaise,
            dueDate: decisionDate,
            recurrenceType: "once",
            isEssential: a.isEssential,
          })
          .returning({ id: commitmentsTable.id });
        commitmentId = commitment.id;
        message = "The future purchase was added as a planned commitment.";
      } else {
        const [created] = await transaction
          .insert(transactionsTable)
          .values({
            userId: id,
            transactionType: "expense",
            amountPaise: a.amountPaise,
            category,
            description,
            transactionDate: decisionDate,
            isEssential: a.isEssential,
          })
          .returning({ id: transactionsTable.id });
        transactionId = created.id;
        message = "The purchase was recorded as an expense.";
      }
    } else if (a.type === "income") {
      if (decisionDate > today) {
        const [profile] = await transaction
          .select()
          .from(financialProfilesTable)
          .where(eq(financialProfilesTable.userId, id))
          .limit(1);
        if (!profile) return { kind: "invalid_saved_scenario" as const };
        await transaction
          .update(financialProfilesTable)
          .set({
            plannedIncomePaise: profile.plannedIncomePaise + a.amountPaise,
          })
          .where(eq(financialProfilesTable.userId, id));
        message = "Future income was added to planned income.";
      } else {
        const [created] = await transaction
          .insert(transactionsTable)
          .values({
            userId: id,
            transactionType: "income",
            amountPaise: a.amountPaise,
            category,
            description,
            transactionDate: decisionDate,
            isEssential: false,
          })
          .returning({ id: transactionsTable.id });
        transactionId = created.id;
        message = "The income was recorded.";
      }
    } else if (a.type === "new_subscription") {
      const [created] = await transaction
        .insert(subscriptionsTable)
        .values({
          userId: id,
          name: a.name,
          amountPaise: a.amountPaise,
          billingFrequency: a.billingFrequency ?? "monthly",
          nextBillingDate: decisionDate,
          category,
          status: "active",
        })
        .returning({ id: subscriptionsTable.id });
      subscriptionId = created.id;
      message = "The subscription was added to your recurring plan.";
    } else if (a.type === "cancel_subscription") {
      if (!a.subscriptionId) return { kind: "invalid_saved_scenario" as const };
      const [updated] = await transaction
        .update(subscriptionsTable)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(subscriptionsTable.id, a.subscriptionId),
            eq(subscriptionsTable.userId, id),
          ),
        )
        .returning({ id: subscriptionsTable.id });
      if (!updated) return { kind: "related_record_missing" as const };
      subscriptionId = updated.id;
      message = "The subscription was cancelled in your plan.";
    } else if (a.type === "savings_contribution") {
      if (!a.goalId) return { kind: "invalid_saved_scenario" as const };
      const [goal] = await transaction
        .select({ id: savingsGoalsTable.id })
        .from(savingsGoalsTable)
        .where(
          and(
            eq(savingsGoalsTable.id, a.goalId),
            eq(savingsGoalsTable.userId, id),
          ),
        )
        .limit(1);
      if (!goal) return { kind: "related_record_missing" as const };
      const [contribution] = await transaction
        .insert(savingsContributionsTable)
        .values({
          userId: id,
          goalId: goal.id,
          amountPaise: a.amountPaise,
          contributionDate: today,
          note: description,
        })
        .returning({ goalId: savingsContributionsTable.goalId });
      goalId = contribution.goalId;
      message = "The amount was earmarked toward the selected savings goal.";
    } else if (a.type === "discretionary_change") {
      await transaction
        .update(financialProfilesTable)
        .set({ dailyDiscretionaryTargetPaise: a.amountPaise })
        .where(eq(financialProfilesTable.userId, id));
      message = "The daily discretionary target was updated.";
    } else if (a.type === "delayed_purchase") {
      const [commitment] = await transaction
        .insert(commitmentsTable)
        .values({
          userId: id,
          name: a.name,
          category,
          amountPaise: a.amountPaise,
          dueDate: decisionDate,
          recurrenceType: "once",
          isEssential: a.isEssential,
        })
        .returning({ id: commitmentsTable.id });
      commitmentId = commitment.id;
      message = "The delayed purchase was added as a planned commitment.";
    }
    const appliedIds = {
      transactionId,
      commitmentId,
      subscriptionId,
      goalId,
      message,
    };
    await transaction
      .update(scenariosTable)
      .set({
        status: "applied",
        appliedAt: new Date(),
        scenarioData: { ...existingData, appliedIds },
      })
      .where(and(eq(scenariosTable.id, scenario.id), eq(scenariosTable.userId, id)));
    await transaction.insert(auditEventsTable).values({
      userId: id,
      eventType: "scenario.applied",
      entityType: "scenario",
      entityId: String(scenario.id),
      safeMetadata: { type: scenario.scenarioType, ...appliedIds },
    });
    return { kind: "applied" as const, id: scenario.id, ...appliedIds };
  });
  if (result.kind === "not_found") return notFound(response);
  if (result.kind === "already_applied") {
    return conflict(response, "This scenario was already applied.");
  }
  if (result.kind === "invalid_saved_scenario") {
    return conflict(response, "This saved scenario is no longer valid and was not applied.");
  }
  if (result.kind === "related_record_missing") {
    return conflict(response, "The related subscription or savings goal no longer exists.");
  }
  response.json(
    ApplyScenarioResponse.parse({
      id: result.id,
      status: "applied",
      message: result.message,
      transactionId: result.transactionId,
      commitmentId: result.commitmentId,
      subscriptionId: result.subscriptionId,
      goalId: result.goalId,
    }),
  );
});

export default router;

