import { NextRequest, NextResponse } from "next/server";
import { requireValidUserKey, ApiContext } from "@/lib/api/auth-wrapper";
import { checkRateLimit } from "@/lib/rateLimiter";
import { acquireLock, releaseLock } from "@/lib/concurrencyLock";

/**
 * 处理 RAG 文档请求
 */
async function handleRagDocuments(
  userKey: string,
  req: NextRequest,
  context: ApiContext
): Promise<NextResponse> {
  const headers = Object.fromEntries(req.headers);
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

  const locked = await acquireLock(userKey, "rag-documents", 60);
  if (!locked) {
    return NextResponse.json(
      { error: "task_already_running" },
      { status: 409 }
    );
  }

  try {
    const result = { status: "ok" };

    await releaseLock(userKey, "rag-documents");
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    await releaseLock(userKey, "rag-documents");
    throw e; // 让包装器处理错误
  }
}

export const POST = requireValidUserKey("/api/rag/documents", handleRagDocuments);