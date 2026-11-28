export type ProviderKind = "api" | "simhost";
export type AuthType = "bearer" | "api_key_header" | "basic" | "query_param" | "login" | "none";
export type ProviderService =
  | "airtime" | "data" | "cable" | "cable_verify" | "electricity" | "electricity_verify" | "exam" | "balance" | "auth" | "status" | "networks";
export type HttpMethod = "GET" | "POST";

export type ResponseField = "status" | "name" | "address" | "balance" | "token" | "expires_in";
export type ResponseMap = Partial<Record<ResponseField, string>>;

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
  tokenScheme?: boolean;
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
  {
    id: "login",
    label: "Log in for a token",
    secretLabel: "Password",
    extra: "username",
    extraLabel: "Username",
    extraHint: "Needs an endpoint with service “Login (get token)”.",
    tokenScheme: true,
  },
  { id: "none", label: "No authentication", secretLabel: "" },
];

export const PROVIDER_SERVICES: { id: ProviderService; label: string }[] = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "cable_verify", label: "Cable TV: smartcard check" },
  { id: "electricity", label: "Electricity" },
  { id: "electricity_verify", label: "Electricity: meter check" },
  { id: "exam", label: "Exam pins" },
  { id: "balance", label: "Balance check" },
  { id: "networks", label: "Network catalog" },
  { id: "auth", label: "Login (get token)" },
  { id: "status", label: "Order status check" },
];

export type ProviderEndpoint = {
  id: string;
  service: ProviderService;
  method: HttpMethod;
  path: string;
  bodyTemplate: string;
  responseMap: ResponseMap;
  active: boolean;
};

type FieldInfo = { key: ResponseField; label: string; hint: string };
const STATUS: FieldInfo = {
  key: "status",
  label: "Status",
  hint: "Where success or failure is stated, like status or data.state. Empty means auto-detect.",
};

export const RESPONSE_FIELDS: Partial<Record<ProviderService, FieldInfo[]>> = {
  balance: [
    { key: "balance", label: "Balance", hint: "Where the balance is, like data.balance. Empty means auto-detect." },
  ],
  auth: [
    { key: "token", label: "Token", hint: "Where the token is, like data.access_token. Required." },
    { key: "expires_in", label: "Lifetime in seconds", hint: "Optional. Without it, the token is reused for 50 minutes." },
  ],
  electricity_verify: [
    { key: "name", label: "Customer name", hint: "Like data.customer_name. Empty means auto-detect." },
    { key: "address", label: "Address", hint: "Optional. Shown under the name." },
    { key: "balance", label: "Balance", hint: "Optional. Only shown if the provider returns one." },
    STATUS,
  ],
  cable_verify: [
    { key: "name", label: "Customer name", hint: "Like data.customer_name. Empty means auto-detect." },
    { key: "balance", label: "Balance", hint: "Optional." },
    STATUS,
  ],
  electricity: [STATUS, { key: "token", label: "Meter token", hint: "Where the prepaid token is. Empty means auto-detect." }],
  airtime: [STATUS],
  data: [STATUS],
  cable: [STATUS],
  status: [STATUS],
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
  /** cable operatorId -> the provider's own cable code */
  cableCodes: Record<string, string>;
  endpoints: ProviderEndpoint[];
};

export const PROVIDERS_PATH = "/admin/gateways/providers";

export const serviceLabel = (id: string) => PROVIDER_SERVICES.find((service) => service.id === id)?.label ?? id;
export const kindLabel = (id: string) => KINDS.find((kind) => kind.id === id)?.label ?? id;
export const authLabel = (id: string) => AUTH_TYPES.find((auth) => auth.id === id)?.label ?? id;
