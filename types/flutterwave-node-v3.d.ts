declare module "flutterwave-node-v3" {
  type FlutterwaveResponse = {
    status: string;
    message?: string;
    data?: unknown;
  };

  type VirtualAccountRequest = {
    email: string;
    is_permanent: boolean;
    bvn?: string;
    amount?: number;
    tx_ref: string;
    narration?: string;
  };

  class Flutterwave {
    constructor(publicKey: string, secretKey: string);
    VirtualAcct: {
      create(input: VirtualAccountRequest): Promise<FlutterwaveResponse>;
    };
    Transaction: {
      verify(input: { id: number }): Promise<FlutterwaveResponse>;
    };
  }

  export = Flutterwave;
}
