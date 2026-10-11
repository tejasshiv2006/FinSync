export type TransactionRecord = {
  type: "income" | "expense" | "refund" | "adjustment";
  amountPaise: number;
  category: string;
  transactionDate: string;
  isEssential: boolean;
};

export type CommitmentRecord = {
  amountPaise: number;
  dueDate: string;
  recurrenceType: "once" | "weekly" | "monthly" | "yearly";
  isEssential: boolean;
  status: "planned" | "paid" | "cancelled";
  name: string;
  category: string;
};

export type SubscriptionRecord = {
  amountPaise: number;
  billingFrequency: "weekly" | "monthly" | "quarterly" | "yearly";
  nextBillingDate: string;
  status: "active" | "paused" | "cancelled";
  name: string;
  category: string;
};

export type FinanceProfile = {
  challengeStartDate: string;
  challengeDurationDays: number;
  startingBudgetPaise: number;
  plannedIncomePaise: number;
  dailyDiscretionaryTargetPaise?: number | null;
  savingsGoalPaise: number;
  emergencyReserveTargetPaise: number;
  timezone: string;
};

export type FinanceInput = {
  profile: FinanceProfile;
  transactions: TransactionRecord[];
  commitments: CommitmentRecord[];
  subscriptions: SubscriptionRecord[];
  savingsContributionsPaise: number;
  today?: string;
  dailyDiscretionaryOverridePaise?: number;
};

export type FinancialSnapshot = {
  currentBalancePaise: number;
  spendableBalancePaise: number;
  dailyAllowancePaise: number;
  savingsProgressPaise: number;
  commitmentCoverage: number;
  projectedMonthEndBalancePaise: number;
  risk: "low" | "moderate" | "high" | "critical";
  healthScore: number;
  riskFactors: string[];
};

export type ForecastPoint = {
  date: string;
  balancePaise: number;
  label: string;
};

export function localDateInTimezone(timezone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function utcDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function dateFromUtcDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  return dateFromUtcDay(utcDay(date) + amount);
}

function addMonths(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + amount, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)),
  ).toISOString().slice(0, 10);
}

function addYears(date: string, amount: number): string {
  return addMonths(date, amount * 12);
}

export function getChallengeWindow(
  profile: FinanceProfile,
  today = localDateInTimezone(profile.timezone),
) {
  const endExclusive = addDays(profile.challengeStartDate, profile.challengeDurationDays);
  const activeStart = today > profile.challengeStartDate ? today : profile.challengeStartDate;
  const daysRemaining = Math.max(0, utcDay(endExclusive) - utcDay(activeStart));
  return { today, endExclusive, activeStart, daysRemaining };
}

function commitmentDates(
  commitment: CommitmentRecord,
  endExclusive: string,
): string[] {
  if (commitment.status !== "planned") return [];
  const dates: string[] = [];
  let date = commitment.dueDate;
  let guard = 0;
  while (date < endExclusive && guard < 400) {
    dates.push(date);
    if (commitment.recurrenceType === "once") break;
    if (commitment.recurrenceType === "weekly") date = addDays(date, 7);
    if (commitment.recurrenceType === "monthly") date = addMonths(date, 1);
    if (commitment.recurrenceType === "yearly") date = addYears(date, 1);
    guard += 1;
  }
  return dates;
}

function subscriptionDates(subscription: SubscriptionRecord, endExclusive: string): string[] {
  if (subscription.status !== "active") return [];
  const dates: string[] = [];
  let date = subscription.nextBillingDate;
  let guard = 0;
  while (date < endExclusive && guard < 400) {
    dates.push(date);
    if (subscription.billingFrequency === "weekly") date = addDays(date, 7);
    if (subscription.billingFrequency === "monthly") date = addMonths(date, 1);
    if (subscription.billingFrequency === "quarterly") date = addMonths(date, 3);
    if (subscription.billingFrequency === "yearly") date = addYears(date, 1);
    guard += 1;
  }
  return dates;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function calculateFinance(input: FinanceInput): {
  snapshot: FinancialSnapshot;
  forecast: ForecastPoint[];
  incomePaise: number;
  expensesPaise: number;
  daysRemaining: number;
  savingsTargetPaise: number;
  insights: string[];
} {
  const { profile, transactions, commitments, subscriptions } = input;
  const window = getChallengeWindow(profile, input.today);
  const incomePaise = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);
  const expensesPaise = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);
  const refundsPaise = transactions
    .filter((transaction) => transaction.type === "refund")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);
  const adjustmentsPaise = transactions
    .filter((transaction) => transaction.type === "adjustment")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  const currentBalancePaise =
    profile.startingBudgetPaise +
    incomePaise +
    refundsPaise +
    adjustmentsPaise -
    expensesPaise;
  const reservedCommitments = commitments.filter(
    (commitment) =>
      commitment.isEssential &&
      commitment.status === "planned" &&
      commitment.dueDate < window.endExclusive,
  );
  const reservedPaise = reservedCommitments.reduce((total, commitment) => {
    return total + commitmentDates(commitment, window.endExclusive)
      .filter((date) => date >= window.today)
      .length * commitment.amountPaise;
  }, 0);
  const savingsProgressPaise = Math.min(
    input.savingsContributionsPaise,
    Number.MAX_SAFE_INTEGER,
  );
  // Savings are earmarked allocations within the simulated balance, not expenses.
  const spendableBalancePaise =
    currentBalancePaise - reservedPaise - savingsProgressPaise;
  const dailyAllowancePaise =
    window.daysRemaining > 0
      ? Math.floor(Math.max(0, spendableBalancePaise) / window.daysRemaining)
      : 0;
  const essentialExposurePaise = reservedCommitments.reduce(
    (total, commitment) =>
      total +
      commitmentDates(commitment, window.endExclusive)
        .filter((date) => date >= window.today)
        .length *
        commitment.amountPaise,
    0,
  );
  const commitmentCoverage =
    essentialExposurePaise === 0
      ? 1
      : Math.max(0, currentBalancePaise) / essentialExposurePaise;

  const elapsedDays = Math.max(
    0,
    Math.min(profile.challengeDurationDays, utcDay(window.today) - utcDay(profile.challengeStartDate)),
  );
  const elapsedExpensesPaise = transactions
    .filter(
      (transaction) =>
        transaction.type === "expense" &&
        transaction.transactionDate >= profile.challengeStartDate &&
        transaction.transactionDate < window.today,
    )
    .reduce((total, transaction) => total + transaction.amountPaise, 0);
  const historicalDailySpend =
    elapsedDays > 0 ? Math.floor(elapsedExpensesPaise / elapsedDays) : 0;
  const dailyDiscretionaryPaise = Math.max(
    0,
    input.dailyDiscretionaryOverridePaise ??
      profile.dailyDiscretionaryTargetPaise ??
      historicalDailySpend,
  );

  const forecast: ForecastPoint[] = [];
  let forecastBalance = currentBalancePaise;
  let lowestForecastBalance = forecastBalance;
  const forecastStart =
    window.today < profile.challengeStartDate ? profile.challengeStartDate : window.today;
  const forecastLength = Math.max(0, utcDay(window.endExclusive) - utcDay(forecastStart));
  const commitCharges = new Map<string, number>();
  const subscriptionCharges = new Map<string, number>();
  for (const commitment of commitments) {
    for (const date of commitmentDates(commitment, window.endExclusive)) {
      if (date >= forecastStart) {
        commitCharges.set(
          date,
          (commitCharges.get(date) ?? 0) + commitment.amountPaise,
        );
      }
    }
  }
  for (const subscription of subscriptions) {
    for (const date of subscriptionDates(subscription, window.endExclusive)) {
      if (date >= forecastStart) {
        subscriptionCharges.set(
          date,
          (subscriptionCharges.get(date) ?? 0) + subscription.amountPaise,
        );
      }
    }
  }
  const expectedIncomeDate = window.today >= forecastStart ? window.today : forecastStart;
  for (let index = 0; index < forecastLength; index += 1) {
    const date = addDays(forecastStart, index);
    if (date === expectedIncomeDate) forecastBalance += profile.plannedIncomePaise;
    forecastBalance -= dailyDiscretionaryPaise;
    forecastBalance -= commitCharges.get(date) ?? 0;
    forecastBalance -= subscriptionCharges.get(date) ?? 0;
    lowestForecastBalance = Math.min(lowestForecastBalance, forecastBalance);
    forecast.push({
      date,
      balancePaise: forecastBalance,
      label: index === forecastLength - 1 ? "Challenge end" : date,
    });
  }
  const projectedMonthEndBalancePaise =
    forecast.at(-1)?.balancePaise ??
    (window.daysRemaining === 0 ? currentBalancePaise : forecastBalance);

  const savingsTargetPaise = Math.max(
    0,
    profile.savingsGoalPaise - savingsProgressPaise,
  );
  const savingsProgressPercent =
    profile.savingsGoalPaise > 0
      ? clampPercent((savingsProgressPaise / profile.savingsGoalPaise) * 100)
      : 100;
  const essentialCoverageScore = clampPercent(commitmentCoverage * 100);
  const cashFlowScore =
    lowestForecastBalance >= 0
      ? 100
      : clampPercent(100 + (lowestForecastBalance / Math.max(1, profile.startingBudgetPaise)) * 100);
  const spendingConsistencyScore =
    historicalDailySpend === 0 || dailyAllowancePaise === 0
      ? 80
      : clampPercent((dailyAllowancePaise / historicalDailySpend) * 100);
  const reserveScore =
    profile.emergencyReserveTargetPaise === 0
      ? 80
      : clampPercent(
          (Math.max(0, currentBalancePaise) / profile.emergencyReserveTargetPaise) * 100,
        );
  const healthScore = Math.round(
    essentialCoverageScore * 0.3 +
      cashFlowScore * 0.25 +
      spendingConsistencyScore * 0.15 +
      savingsProgressPercent * 0.2 +
      reserveScore * 0.1,
  );

  const riskFactors: string[] = [];
  if (currentBalancePaise < 0) riskFactors.push("Recorded spending is above the available starting funds.");
  if (lowestForecastBalance < 0) riskFactors.push("The estimate falls below zero before the challenge ends.");
  if (essentialExposurePaise > 0 && commitmentCoverage < 1) {
    riskFactors.push("Current funds may not cover all planned essential commitments.");
  }
  if (profile.emergencyReserveTargetPaise > currentBalancePaise) {
    riskFactors.push("The current balance is below the emergency reserve target.");
  }
  if (historicalDailySpend > dailyAllowancePaise && elapsedDays > 0) {
    riskFactors.push("Recent daily spending is above the remaining daily allowance.");
  }
  if (savingsTargetPaise > 0 && window.daysRemaining > 0) {
    const requiredDailySavings = Math.ceil(savingsTargetPaise / window.daysRemaining);
    if (requiredDailySavings > Math.max(0, spendableBalancePaise) / window.daysRemaining) {
      riskFactors.push("The savings target may not fit within the remaining spendable balance.");
    }
  }
  const upcomingRecurringPaise = subscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce(
      (total, subscription) =>
        total +
        subscriptionDates(subscription, window.endExclusive)
          .filter((date) => date >= window.today)
          .length *
          subscription.amountPaise,
      0,
    );
  if (upcomingRecurringPaise > Math.max(0, currentBalancePaise) * 0.25) {
    riskFactors.push("Recurring payments account for a sizeable share of the current balance.");
  }

  let risk: FinancialSnapshot["risk"] = "low";
  if (currentBalancePaise < 0 || lowestForecastBalance < 0 && commitmentCoverage < 0.5) {
    risk = "critical";
  } else if (lowestForecastBalance < 0 || commitmentCoverage < 0.75) {
    risk = "high";
  } else if (riskFactors.length > 0 || spendableBalancePaise < 0) {
    risk = "moderate";
  }
  if (riskFactors.length === 0) {
    riskFactors.push("No immediate shortfall is projected from the records and assumptions currently entered.");
  }

  const insights: string[] = [];
  if (reservedPaise > 0) {
    insights.push("Essential commitments are reserved before calculating your spendable balance.");
  }
  if (historicalDailySpend > dailyAllowancePaise && elapsedDays > 0) {
    insights.push("Your recent daily spending is above the current allowance.");
  }
  if (savingsTargetPaise > 0 && window.daysRemaining > 0) {
    insights.push(
      `About ₹${Math.ceil(savingsTargetPaise / window.daysRemaining / 100).toLocaleString("en-IN")} per day would reach the remaining savings target.`,
    );
  }
  if (upcomingRecurringPaise > 0) {
    insights.push("Upcoming subscription charges are included in the challenge estimate.");
  }
  if (insights.length === 0) {
    insights.push("Add a transaction or commitment to see how it changes your plan.");
  }

  return {
    snapshot: {
      currentBalancePaise,
      spendableBalancePaise,
      dailyAllowancePaise,
      savingsProgressPaise,
      commitmentCoverage,
      projectedMonthEndBalancePaise,
      risk,
      healthScore,
      riskFactors,
    },
    forecast,
    incomePaise,
    expensesPaise,
    daysRemaining: window.daysRemaining,
    savingsTargetPaise,
    insights,
  };
}

export function paiseFromRupeesInput(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Enter a valid rupee amount.");
  }
  const text = String(value).trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter a positive amount with up to two decimal places.");
  }
  const [rupees, fraction = ""] = text.split(".");
  const amount = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("The amount must be greater than zero.");
  }
  return amount;
}

