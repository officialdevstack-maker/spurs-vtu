export type AuditRecord = {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  summary: string;
  meta: Record<string, unknown>;
  at: string;
};

export const AUDIT_PATH = "/admin/audit";
export const AUDIT_PAGE_SIZE = 50;
