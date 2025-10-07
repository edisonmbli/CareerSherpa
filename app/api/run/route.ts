import { NextResponse } from "next/server";
import crypto from "crypto";
import { logInfo, logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimiter";
import { acquireLock, releaseLock } from "@/lib/concurrencyLock";
import { assertRequiredKeysForRun } from "@/lib/env";

export async function POST(req: Request) {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  const route = "/api/run";
  const headers = Object.fromEntries(req.headers);
  const url = new URL(req.url);
  const delayMs = Number(url.searchParams.get("delayMs") ?? "0");
  const skipKeyCheck = url.searchParams.get("skipKeyCheck") === "true";
  const userKey =
    (headers["x-user-key"] as string | undefined) ??
    (headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ??
    "unknown";
  const isTrial =
    !headers["x-user-key"] || (headers["x-is-trial"] as string) === "true";
  const lang = (headers["x-lang"] as string) ?? "en";

  const rate = await checkRateLimit(route, userKey, !!isTrial);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after: rate.retryAfter },
      { status: 429 }
    );
  }

  const locked = await acquireLock(userKey, "run", 120);
  if (!locked) {
    return NextResponse.json(
      { error: "task_already_running" },
      { status: 409 }
    );
  }

  logInfo({ reqId, route, userKey, isTrial: !!isTrial, lang });

  try {
    if ((headers["x-simulate-missing-key"] as string) === "true") {
      throw new Error("missing_OPENAI_API_KEY");
    }
    if (!skipKeyCheck) {
      assertRequiredKeysForRun();
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const result = { status: "ok" };

    const durationMs = Date.now() - start;
    logInfo({ reqId, route, userKey, isTrial: !!isTrial, lang, durationMs });
    await releaseLock(userKey, "run");
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const durationMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    logError({
      reqId,
      route,
      userKey,
      isTrial: !!isTrial,
      lang,
      durationMs,
      error: msg ?? "internal_error",
    });
    await releaseLock(userKey, "run");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
