export type BilalsadasubNetwork = { name: string; id: string };
export type LocalNetwork = { id: string; name: string };

function normalizeNetworkName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mergeBilalsadasubNetworkCodes(
  remoteNetworks: BilalsadasubNetwork[],
  localNetworks: LocalNetwork[],
  currentCodes: Record<string, string>,
): { codes: Record<string, string>; matched: number } {
  const localIdsByName = new Map(
    localNetworks.map((network) => [normalizeNetworkName(network.name), network.id]),
  );
  const codes = { ...currentCodes };
  let matched = 0;

  for (const remote of remoteNetworks) {
    const localId = localIdsByName.get(normalizeNetworkName(remote.name));
    if (!localId) continue;
    codes[localId] = remote.id;
    matched++;
  }

  return { codes, matched };
}
