"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import {
  PROVIDER_SERVICES,
  type HttpMethod,
  type Provider,
  type ProviderEndpoint,
  type ProviderService,
} from "@/lib/admin/providers";
import type { ResponseMap } from "@/lib/admin/providers";
import type { EndpointFields } from "@/lib/db/providers";
import type { ActionResult } from "@/app/admin/gateways/providers/actions";
import { ResponseMapFields } from "./response-map-fields";

export function EndpointDialog({
  provider,
  endpoint,
  onSubmit,
  onClose,
}: {
  provider: Provider;
  endpoint?: ProviderEndpoint;
  onSubmit: (input: EndpointFields) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const taken = new Set(provider.endpoints.map((item) => item.service));
  const available = PROVIDER_SERVICES.filter((item) => item.id === endpoint?.service || !taken.has(item.id));
  const [service, setService] = useState<ProviderService>(endpoint?.service ?? available[0]?.id ?? "airtime");
  const [method, setMethod] = useState<HttpMethod>(endpoint?.method ?? "POST");
  const [path, setPath] = useState(endpoint?.path ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(endpoint?.bodyTemplate ?? "");
  const [responseMap, setResponseMap] = useState<ResponseMap>(endpoint?.responseMap ?? {});
  const [active, setActive] = useState(endpoint?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyHint =
    service === "airtime"
      ? "Airtime placeholders: {phone} {amount} {network} {type} {plan} {reference}. {plan} is null for airtime; use {type} for the network type (for example VTU)."
      : service === "cable"
        ? "Cable placeholders: {phone} {amount} {operator} {plan} {smartcard} {reference}. Map each local operator to the provider's cable ID in Cable operator codes."
        : "Placeholders: {phone} {amount} {network} {plan} {type} {reference} {meter} {decoder} {disco} {username} {password}";
  const bodyPlaceholder =
    service === "airtime"
      ? '{"network": {network}, "mobile_number": {phone}, "amount": {amount}, "plan": {plan}}'
      : service === "cable"
        ? '{"cable": {operator}, "cable_plan": {plan}, "iuc": {smartcard}, "request-id": {reference}}'
        : '{"network": {network}, "mobile_number": {phone}, "plan": {plan}}';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await onSubmit({ service, method, path, bodyTemplate, responseMap, active });
        if (result.ok) {
          toast.success(endpoint ? "Endpoint updated" : "Endpoint added");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[providers] Failed to save endpoint", cause);
        setError("Could not save the endpoint. Please try again.");
      }
    });
  }

  return (
    <Modal title={endpoint ? "Edit endpoint" : `Add endpoint to ${provider.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}

        <Field id={`${base}-service`} label="Service" hint="Each provider has one endpoint per service.">
          <select
            id={`${base}-service`}
            value={service}
            disabled={!!endpoint}
            onChange={(event) => {
              const nextService = event.target.value as ProviderService;
              setService(nextService);
              if (nextService === "networks") setMethod("GET");
            }}
            className={inputClass()}
          >
            {available.length === 0 && <option value="">All services added</option>}
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4">
          <Field id={`${base}-method`} label="Method">
            <select
              id={`${base}-method`}
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
              className={inputClass()}
            >
              <option value="POST" disabled={service === "networks"}>POST</option>
              <option value="GET">GET</option>
            </select>
          </Field>
          <Field id={`${base}-path`} label="Path" hint={`Appended to ${provider.baseUrl}`}>
            <input
              id={`${base}-path`}
              autoFocus
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder={service === "networks" ? "/api/v1/plans/networks" : "/api/data/"}
              maxLength={300}
              className={`${inputClass()} font-[family-name:var(--font-geist-mono)] text-sm`}
            />
          </Field>
        </div>

        {method === "POST" && (
          <Field
            id={`${base}-body`}
            label="Body template"
            hint={bodyHint}
          >
            <textarea
              id={`${base}-body`}
              value={bodyTemplate}
              onChange={(event) => setBodyTemplate(event.target.value)}
              rows={5}
              maxLength={2000}
              spellCheck={false}
              placeholder={bodyPlaceholder}
              className="w-full rounded-xl border border-[#BFCFD2] bg-white px-4 py-3 font-[family-name:var(--font-geist-mono)] text-sm text-[#12343B] outline-none transition-colors placeholder:text-[#7C9195] focus-visible:border-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B]/25"
            />
          </Field>
        )}

        <ResponseMapFields service={service} value={responseMap} onChange={setResponseMap} />

        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="size-5 accent-[#1E8E4F]"
          />
          Use this endpoint
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending || available.length === 0} className={btnPrimary}>
            {pending ? "Saving…" : endpoint ? "Save endpoint" : "Add endpoint"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
