import { StackServerApp } from "@stackframe/stack";
import { isStackAuthReady } from "@/lib/env";

// Safe initialization: fall back to a lightweight stub when env is missing
let stackServerApp: any;

if (isStackAuthReady()) {
  stackServerApp = new StackServerApp({
    tokenStore: "nextjs-cookie",
    projectId: process.env["NEXT_PUBLIC_STACK_PROJECT_ID"]!,
    publishableClientKey: process.env["NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"]!,
    secretServerKey: process.env["STACK_SECRET_SERVER_KEY"]!,
    baseUrl: process.env["NEXT_PUBLIC_STACK_URL"] || "https://api.stack-auth.com",
  });
} else {
  // Minimal stub used during build/dev when Stack Auth keys are not configured
  stackServerApp = {
    getUser: async () => null,
  } as const;
}

export { stackServerApp };