export const PERMISSIONS = [
  "customers.view",
  "customers.manage",
  "packages.manage",
  "products.view",
  "products.manage",
  "gateways.manage",
  "transactions.view",
  "announcements.manage",
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);

export const PERMISSION_GROUPS: {
  id: string;
  label: string;
  permissions: { id: Permission; label: string; hint: string }[];
}[] = [
  {
    id: "customers",
    label: "Customers",
    permissions: [
      { id: "customers.view", label: "View customers", hint: "See the customer list and details." },
      { id: "customers.manage", label: "Manage customers", hint: "Suspend and reactivate accounts." },
    ],
  },
  {
    id: "packages",
    label: "Packages",
    permissions: [
      { id: "packages.manage", label: "Manage packages", hint: "Add, edit and delete packages and set upgrade fees." },
    ],
  },
  {
    id: "products",
    label: "Products",
    permissions: [
      { id: "products.view", label: "View products", hint: "See networks, plans, discounts and pin stock." },
      { id: "products.manage", label: "Manage products", hint: "Add, edit, switch off and delete products." },
    ],
  },
  {
    id: "gateways",
    label: "Gateways",
    permissions: [
      { id: "gateways.manage", label: "Manage providers", hint: "View and change providers, endpoints and secrets." },
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    permissions: [
      { id: "transactions.view", label: "View transactions", hint: "Review transaction history and the calculator." },
    ],
  },
  {
    id: "announcements",
    label: "Announcements",
    permissions: [
      { id: "announcements.manage", label: "Manage announcements", hint: "Post notices to all users." },
    ],
  },
  {
    id: "roles",
    label: "Roles & permissions",
    permissions: [
      {
        id: "roles.manage",
        label: "Manage roles and staff",
        hint: "Can edit any role, including their own, so only give this to people you fully trust.",
      },
    ],
  },
];
