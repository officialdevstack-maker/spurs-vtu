export function normalizeCatalogName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseCatalogPlanName(
  value: string,
): { volume: number; unit: "mb" | "gb" } | null {
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(mb|gb)$/i);
  if (!match) return null;
  const volume = Number(match[1]);
  if (!Number.isFinite(volume) || volume <= 0) return null;
  return { volume, unit: match[2].toLowerCase() as "mb" | "gb" };
}

export function matchCatalogPlanType(
  remoteType: string,
  localTypes: { id: string; label: string }[],
): string | null {
  const remote = normalizeCatalogName(remoteType);
  const exact = localTypes.find(
    (type) =>
      normalizeCatalogName(type.id) === remote ||
      normalizeCatalogName(type.label) === remote,
  );
  return exact?.id ?? null;
}
