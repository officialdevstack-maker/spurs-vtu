export type Package = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  upgradeFee: number;
  isDefault: boolean;
  customers: number;
};

export const PACKAGES_PATH = "/admin/users/packages";
export const CUSTOMER_PACKAGES_PATH = "/dashboard/packages";
