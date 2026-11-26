import type { ThreadMessage } from "@/lib/admin/support";
import { formatWhen } from "@/lib/format";

export function TicketThread({ messages, viewer }: { messages: ThreadMessage[]; viewer: "customer" | "admin" }) {
  const now = new Date();
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = viewer === "admin" ? m.fromStaff : !m.fromStaff;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              mine ? "bg-[#12343B] text-white dark:bg-[#F2B632] dark:text-[#12343B]"
                   : "border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-2 text-xs ${mine ? "opacity-80" : "text-gray-600 dark:text-[#9FB3B7]"}`}>
                {m.author} · {formatWhen(m.at, now)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
