"use client";

import { useState } from "react";
import { RESPONSE_FIELDS, type ProviderService, type ResponseMap } from "@/lib/admin/providers";
import { readPath, toText } from "@/lib/providers/response-map";

const field =
  "h-10 w-full rounded-xl border border-gray-300 bg-white px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function ResponseMapFields({
  service,
  value,
  onChange,
}: {
  service: ProviderService;
  value: ResponseMap;
  onChange: (next: ResponseMap) => void;
}) {
  const [sample, setSample] = useState("");
  const fields = RESPONSE_FIELDS[service];
  if (!fields) return null;

  let parsed: unknown;
  let badSample = false;
  if (sample.trim()) {
    try {
      parsed = JSON.parse(sample);
    } catch {
      badSample = true;
    }
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
      <legend className="px-1 text-sm font-semibold">Response mapping</legend>
      <p className="text-xs text-gray-600 dark:text-[#9FB3B7]">
        Tell us where things are in the provider&apos;s JSON reply, using dots for nesting, like <code>data.customer_name</code>.
      </p>
      {fields.map((item) => {
        const path = value[item.key] ?? "";
        const found = parsed !== undefined && path ? readPath(parsed, path) : undefined;
        return (
          <div key={item.key}>
            <label htmlFor={`map-${item.key}`} className="mb-1 block text-sm font-medium">{item.label}</label>
            <input
              id={`map-${item.key}`}
              className={field}
              value={path}
              autoComplete="off"
              onChange={(e) => onChange({ ...value, [item.key]: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{item.hint}</p>
            {parsed !== undefined && path && (
              <p className="mt-1 text-xs">
                {found === undefined ? "Not found in the sample." : `Found: ${toText(found, 60) ?? "(not plain text)"}`}
              </p>
            )}
          </div>
        );
      })}
      <div>
        <label htmlFor="map-sample" className="mb-1 block text-sm font-medium">Try it on a sample reply (optional)</label>
        <textarea
          id="map-sample"
          rows={5}
          className={`${field} h-auto py-2`}
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder='{"status": true, "data": {"customer_name": "JANE DOE"}}'
        />
        <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
          {badSample ? "That isn't valid JSON." : "Use made-up values. Don't paste real tokens."}
        </p>
      </div>
    </fieldset>
  );
}
