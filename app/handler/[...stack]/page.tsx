import { StackHandler } from '@stackframe/stack';
import { stackServerApp } from "../../../stack/server";

export default async function Handler({ params, searchParams }: { params: Promise<{ stack: string[] }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const p = await params
  const sp = await searchParams
  return (
    <div className="auth-scope">
      <StackHandler app={stackServerApp} fullPage routeProps={{ params: p, searchParams: sp }} />
    </div>
  );
}
