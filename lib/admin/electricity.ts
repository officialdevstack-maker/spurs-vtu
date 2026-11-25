export type Disco = {
  id: string;
  name: string;
  providerCode: string;
  enabled: boolean;
  discount: number;
  providerId: string | null;
  providerName: string | null;
  providerDiscount: number | null;
  minAmount: number;
  maxAmount: number;
};

export const ELECTRICITY_PATH = "/admin/products/electricity";
