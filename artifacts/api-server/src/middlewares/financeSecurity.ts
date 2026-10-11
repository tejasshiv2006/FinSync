import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

type AuthenticatedRequest = Express.Request;
const mutationWindows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 5 * 60_000;
const WINDOW_LIMIT = 120;

export const requireAuth: RequestHandler = (request, response, next) => {
  const { userId } = getAuth(request);
  if (!userId) {
    response.status(401).json({ error: "Sign in to access your financial data." });
    return;
  }
  (request as AuthenticatedRequest).userId = userId;
  next();
};

export const requireSameOriginForMutations: RequestHandler = (
  request,
  response,
  next,
) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = request.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = (forwardedHost || request.get("host") || "").toLowerCase();
    if (!expectedHost || originHost !== expectedHost) {
      response.status(403).json({ error: "Cross-origin request denied." });
      return;
    }
    next();
  } catch {
    response.status(403).json({ error: "Invalid request origin." });
  }
};

export const rateLimitFinancialMutations: RequestHandler = (
  request,
  response,
  next,
) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    next();
    return;
  }
  const userId = (request as AuthenticatedRequest).userId;
  if (!userId) {
    response.status(401).json({ error: "Sign in to access your financial data." });
    return;
  }
  const now = Date.now();
  const existing = mutationWindows.get(userId);
  if (!existing || existing.resetAt <= now) {
    mutationWindows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (existing.count >= WINDOW_LIMIT) {
    response.status(429).json({ error: "Too many updates. Please try again shortly." });
    return;
  }
  existing.count += 1;
  next();
};

