export const NETWORK_IDS = ["mtn", "glo", "airtel", "9mobile"] as const;
export type NetworkId = (typeof NETWORK_IDS)[number];

/** Add a network type here and it shows up in the UI and in validation. */
export const DATA_TYPES = [
  { id: "sme", label: "SME" },
  { id: "vtu", label: "VTU" },
  { id: "sns", label: "SNS" },
] as const;
export type DataType = (typeof DATA_TYPES)[number]["id"];

export const typeLabel = (id: DataType) => DATA_TYPES.find((t) => t.id === id)?.label ?? id.toUpperCase();

export type DataPlan = {
  id: string;
  type: DataType;
  size: string;
  validity: string;
  /** What you pay the provider */
  cost: number;
  /** What the customer pays */
  price: number;
  active: boolean;
};

export type PinStock = {
  id: string;
  label: string;
  price: number;
  available: number;
  used: number;
};

export type NetworkProduct = {
  id: NetworkId;
  name: string;
  enabled: boolean;
  /** Percent off airtime, 0..100 */
  airtimeDiscount: number;
  enabledTypes: DataType[];
  plans: DataPlan[];
  airtimePins: PinStock[];
  dataPins: PinStock[];
};

const plan = (
  id: string,
  type: DataType,
  size: string,
  validity: string,
  cost: number,
  price: number,
  active = true,
): DataPlan => ({ id, type, size, validity, cost, price, active });

const pin = (id: string, label: string, price: number, available: number, used: number): PinStock => ({
  id,
  label,
  price,
  available,
  used,
});

/**
 * Sample data. Replace the body with your real queries (networks, their data
 * plans, airtime discount, enabled types and pin stock counts).
 */
export async function getAirtimeDataProducts(): Promise<NetworkProduct[]> {
  return [
    {
      id: "mtn",
      name: "MTN",
      enabled: true,
      airtimeDiscount: 2.5,
      enabledTypes: ["sme", "vtu", "sns"],
      plans: [
        plan("mtn-1", "sme", "500MB", "30 days", 130, 145),
        plan("mtn-2", "sme", "1GB", "30 days", 250, 270),
        plan("mtn-3", "sme", "2GB", "30 days", 500, 530),
        plan("mtn-4", "vtu", "1.5GB", "30 days", 950, 1000),
        plan("mtn-5", "sns", "3GB", "30 days", 1400, 1480, false),
      ],
      airtimePins: [
        pin("mtn-ap-1", "₦100 airtime pin", 98, 240, 560),
        pin("mtn-ap-2", "₦200 airtime pin", 196, 120, 310),
        pin("mtn-ap-3", "₦500 airtime pin", 490, 8, 190),
      ],
      dataPins: [pin("mtn-dp-1", "1GB · 30 days", 270, 60, 95), pin("mtn-dp-2", "2GB · 30 days", 530, 5, 41)],
    },
    {
      id: "glo",
      name: "Glo",
      enabled: true,
      airtimeDiscount: 3,
      enabledTypes: ["sme", "vtu"],
      plans: [
        plan("glo-1", "sme", "1GB", "14 days", 280, 300),
        plan("glo-2", "sme", "2.9GB", "30 days", 900, 940),
        plan("glo-3", "vtu", "5.8GB", "30 days", 1900, 1980),
      ],
      airtimePins: [pin("glo-ap-1", "₦100 airtime pin", 97, 90, 140), pin("glo-ap-2", "₦200 airtime pin", 194, 45, 80)],
      dataPins: [pin("glo-dp-1", "2.9GB · 30 days", 940, 22, 18)],
    },
    {
      id: "airtel",
      name: "Airtel",
      enabled: true,
      airtimeDiscount: 2,
      enabledTypes: ["sme", "vtu", "sns"],
      plans: [
        plan("airtel-1", "sme", "1GB", "7 days", 320, 345),
        plan("airtel-2", "sns", "2GB", "30 days", 1450, 1500),
        plan("airtel-3", "vtu", "4GB", "30 days", 2000, 2090),
      ],
      airtimePins: [pin("airtel-ap-1", "₦100 airtime pin", 98, 150, 220)],
      dataPins: [],
    },
    {
      id: "9mobile",
      name: "9mobile",
      enabled: false,
      airtimeDiscount: 3.5,
      enabledTypes: ["sme"],
      plans: [plan("9m-1", "sme", "1.5GB", "30 days", 480, 510, false)],
      airtimePins: [],
      dataPins: [],
    },
  ];
}
