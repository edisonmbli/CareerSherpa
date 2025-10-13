import { NextRequest, NextResponse } from "next/server";
import { requireValidUserKey, ApiContext } from "@/lib/api/auth-wrapper";
import { checkRateLimit } from "@/lib/rateLimiter";
import { acquireLock, releaseLock } from "@/lib/concurrencyLock";
import { assertRequiredKeysForRun } from "@/lib/env";

/**
 * 处理运行请求
 */
async function handleRunRequest(
  userKey: string,
  req: NextRequest,
  context: ApiContext
): Promise<NextResponse> {
  const headers = Object.fromEntries(req.headers);
  const url = new URL(req.url);
  const delayMs = Number(url.searchParams.get("delayMs") ?? "0");
  const skipKeyCheck = url.searchParams.get("skipKeyCheck") === "true";
  const isTrial =
    !headers["x-user-key"] || (headers["x-is-trial"] as string) === "true";
  const lang = (headers["x-lang"] as string) ?? "en";

  const rate = await checkRateLimit(context.route, userKey, !!isTrial);
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

    await releaseLock(userKey, "run");
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    await releaseLock(userKey, "run");
    throw e; // 让包装器处理错误
  }
}

export const POST = requireValidUserKey("/api/run", handleRunRequest);
