import { getSpursUser, requireSpursUser } from "@spurs-cloud/accounts/next";
import SpursAccountMenu, { SpursSignInButton } from "@spurs-cloud/accounts/react";
import Image from "next/image";

export default async function Home() {
  const user = await getSpursUser();
  const me  = await requireSpursUser()
  return (
    <div className="">
    <SpursAccountMenu user={user} /> 
    <div className="">
      <SpursSignInButton issuer={process.env.SPURS_ISSUER}  />
    </div>
    <div className="">{ JSON.stringify(me) }</div>
    </div>
  );
}
