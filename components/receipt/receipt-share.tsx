"use client";

import { useState, useTransition } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createReceiptLink } from "@/app/dashboard/transactions/[id]/actions";

const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]";

export function ReceiptShare({ id }: { id: string }) {
  const [links, setLinks] = useState<{ page: string; image: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      try {
        const result = await createReceiptLink(id);
        if (!result.ok) return void toast.error(result.error);
        setLinks({ page: result.page, image: result.image });
      } catch {
        toast.error("Could not create a link. Try again.");
      }
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  async function share(url: string) {
    try {
      await navigator.share({ title: "Spur VTU receipt", url });
    } catch {
      /* the person closed the share sheet */
    }
  }

  if (!links) {
    return (
      <button type="button" onClick={create} disabled={isPending} className={button}>
        <Share2 className="size-4" aria-hidden="true" />
        {isPending ? "Creating link..." : "Share receipt"}
      </button>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
        Anyone with this link can see this receipt until it expires in 30 days. It hides most of the number.
      </p>
      <p className="break-all text-sm font-medium">{links.page}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => copy(links.page)}>
          <Link2 className="size-4" aria-hidden="true" /> Copy link
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button type="button" className={button} onClick={() => share(links.page)}>
            <Share2 className="size-4" aria-hidden="true" /> Share
          </button>
        )}
        <a className={button} href={`${links.image}?download=1`}>
          <Download className="size-4" aria-hidden="true" /> Download image
        </a>
      </div>
    </section>
  );
}
