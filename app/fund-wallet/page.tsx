import { SPURS_WALLET_URL } from "@spurs-cloud/wallet";
import { redirect } from "next/navigation";

export default function FundWalletPage() {
  const walletUrl = (process.env.SPURS_WALLET_URL || SPURS_WALLET_URL).replace(/\/$/, "");
  redirect(`${walletUrl}/dashboard`);
}
