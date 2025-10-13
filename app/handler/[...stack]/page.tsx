import { StackHandler } from '@stackframe/stack';
import { stackServerApp } from "../../../stack/server";

interface HandlerProps {
  params: { stack: string[] }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Handler(props: HandlerProps) {
  return (
    <div className="auth-scope">
      <StackHandler app={stackServerApp} fullPage routeProps={props} />
    </div>
  );
}