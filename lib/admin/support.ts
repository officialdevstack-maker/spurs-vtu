export type TicketStatus = "open" | "answered" | "closed";

export const SUPPORT_PATH = "/admin/support";
export const CUSTOMER_SUPPORT_PATH = "/dashboard/support";
export const SUBJECT_LIMIT = 100;
export const BODY_LIMIT = 2000;
export const MAX_OPEN = 5;
export const MAX_MESSAGES = 200;

export const STATUS_LABEL: Record<TicketStatus, { admin: string; customer: string }> = {
  open: { admin: "Needs reply", customer: "Waiting for support" },
  answered: { admin: "Waiting on customer", customer: "Support replied" },
  closed: { admin: "Closed", customer: "Closed" },
};

export const isTicketStatus = (v: unknown): v is TicketStatus =>
  v === "open" || v === "answered" || v === "closed";

export type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  customer: string;
  messages: number;
  at: string;
};

export type ThreadMessage = { id: string; fromStaff: boolean; author: string; body: string; at: string };

export type TicketDetail = {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  customer: { id: string; label: string; email: string | null; phone: string | null };
  transaction: { id: string; title: string; amount: number; status: string } | null;
  messages: ThreadMessage[];
};
