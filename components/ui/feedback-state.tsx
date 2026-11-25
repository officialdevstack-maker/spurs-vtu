import type { ReactNode } from "react";
import {
  CheckCircle2,
  Compass,
  Inbox,
  KeyRound,
  ServerCrash,
  ShieldAlert,
  SignalLow,
  Wrench,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { ErrorScreen } from "@/components/errors/error-screen";

const states = {
  "session-expired": {
    code: "Session expired",
    title: "Please log in again",
    text: "For your security, your session has ended. Log in to continue where you left off.",
    icon: KeyRound,
  },
  "slow-network": {
    code: "Slow connection",
    title: "This is taking longer than usual",
    text: "Your connection seems slow. Wait a moment, then try again.",
    icon: SignalLow,
  },
  offline: {
    code: "No connection",
    title: "You're offline",
    text: "Check your internet connection and try again when you're back online.",
    icon: WifiOff,
  },
  empty: {
    code: "Nothing here yet",
    title: "No items to show",
    text: "When there is something to show, it will appear here.",
    icon: Inbox,
  },
  "not-found": {
    code: "Error 404",
    title: "We can't find that page",
    text: "The link may be old, or the page may have moved. Check the address and try again.",
    icon: Compass,
  },
  forbidden: {
    code: "Access denied",
    title: "You don't have access to this page",
    text: "If you think you should have access, ask an administrator to check your permissions.",
    icon: ShieldAlert,
  },
  unavailable: {
    code: "Temporarily unavailable",
    title: "We'll be back shortly",
    text: "This service is temporarily unavailable. Please try again in a little while.",
    icon: Wrench,
  },
  error: {
    code: "Something went wrong",
    title: "That didn't work",
    text: "Please try again. If the problem continues, contact support.",
    icon: ServerCrash,
  },
  success: {
    code: "Complete",
    title: "You're all set",
    text: "Your request was completed successfully.",
    icon: CheckCircle2,
  },
} satisfies Record<
  string,
  { code: string; title: string; text: string; icon: LucideIcon }
>;

export type FeedbackStateKind = keyof typeof states;

export function FeedbackState({
  kind,
  title,
  description,
  compact,
  children,
}: {
  kind: FeedbackStateKind;
  title?: string;
  description?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  const state = states[kind];

  return (
    <ErrorScreen
      code={state.code}
      icon={state.icon}
      title={title ?? state.title}
      text={description ?? state.text}
      compact={compact ?? kind === "empty"}
    >
      {children}
    </ErrorScreen>
  );
}
