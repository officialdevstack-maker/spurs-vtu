import "server-only";
import { notify } from "@/lib/notify";
import { listSupportRecipients } from "@/lib/db/support";

const excerpt = (text: string, max = 200) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function notifyStaff(input: {
  ticketId: string; messageId: string; authorId: string; title: string; subject: string; from: string;
}) {
  const ids = (await listSupportRecipients()).filter((id) => id !== input.authorId);
  await Promise.allSettled(
    ids.map((id) =>
      notify(id, {
        id: `support-${input.messageId}-${id}`,
        category: "system",
        title: input.title,
        body: `${input.from}: ${input.subject}`,
        url: `/admin/support/${input.ticketId}`,
      }),
    ),
  );
}

export const notifyCustomerOfReply = (input: { customerId: string; ticketId: string; messageId: string; subject: string; body: string }) =>
  notify(input.customerId, {
    id: `support-${input.messageId}`,
    category: "system",
    title: "Support replied to your ticket",
    body: `${input.subject}\n\n${excerpt(input.body)}`,
    url: `/dashboard/support/${input.ticketId}`,
  });
