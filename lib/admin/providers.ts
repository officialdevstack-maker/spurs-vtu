export type ProviderKind = "api" | "simhost";
export type AuthType = "bearer" | "api_key_header" | "basic" | "query_param" | "none";
export type ProviderService = "airtime" | "data" | "cable" | "electricity" | "exam" | "balance";
export type HttpMethod = "GET" | "POST";

export const KINDS: { id: ProviderKind; label: string; hint: string }[] = [
  { id: "api", label: "Third-party API", hint: "A vendor API. HTTPS only." },
  { id: "simhost", label: "SIM host", hint: "Your own SIM host or gateway. HTTP or HTTPS." },
];

export const AUTH_TYPES: {
  id: AuthType;
  label: string;
  secretLabel: string;
  extra?: "name" | "username";
  extraLabel?: string;
  extraHint?: string;
}[] = [
  { id: "bearer", label: "Bearer token", secretLabel: "Token" },
  {
    id: "api_key_header",
    label: "API key in header",
    secretLabel: "API key",
    extra: "name",
    extraLabel: "Header name",
    extraHint: "For example X-API-Key or Token.",
  },
  { id: "basic", label: "Username and password", secretLabel: "Password", extra: "username", extraLabel: "Username" },
  {
    id: "query_param",
    label: "API key in URL",
    secretLabel: "API key",
    extra: "name",
    extraLabel: "Parameter name",
    extraHint: "For example api_key or token.",
  },
  { id: "none", label: "No authentication", secretLabel: "" },
];

export const PROVIDER_SERVICES: { id: ProviderService; label: string }[] = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "electricity", label: "Electricity" },
  { id: "exam", label: "Exam pins" },
  { id: "balance", label: "Balance check" },
];

export type ProviderEndpoint = {
  id: string;
  service: ProviderService;
  method: HttpMethod;
  path: string;
  bodyTemplate: string;
  active: boolean;
};

export type NetworkOption = { id: string; name: string };

export type Provider = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  authType: AuthType;
  authName: string;
  authUsername: string;
  hasSecret: boolean;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  /** networkId -> the provider's own network code */
  networkCodes: Record<string, string>;
  endpoints: ProviderEndpoint[];
};

export const PROVIDERS_PATH = "/admin/gateways/providers";

export const serviceLabel = (id: string) => PROVIDER_SERVICES.find((service) => service.id === id)?.label ?? id;
export const kindLabel = (id: string) => KINDS.find((kind) => kind.id === id)?.label ?? id;
export const authLabel = (id: string) => AUTH_TYPES.find((auth) => auth.id === id)?.label ?? id;
