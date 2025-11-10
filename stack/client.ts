"use client";
import { StackClientApp } from "@stackframe/stack";
import { isStackAuthReady } from "@/lib/env";

// Safe initialization: fall back to a lightweight stub in dev/build without keys
export const stackClientApp: any = isStackAuthReady()
  ? new StackClientApp({
      baseUrl: process.env["NEXT_PUBLIC_STACK_URL"] || "https://api.stack-auth.com",
      projectId: process.env["NEXT_PUBLIC_STACK_PROJECT_ID"]!,
      publishableClientKey: process.env["NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"]!,
      tokenStore: "nextjs-cookie",
    })
  : {
      // Minimal surface to satisfy imports when Stack Auth is disabled
    };