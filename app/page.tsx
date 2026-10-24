import { getSpursUser, requireSpursUser } from "@spurs-cloud/accounts/next";
import SpursAccountMenu, { SpursSignInButton } from "@spurs-cloud/accounts/react";
import { Suspense } from "react";

async function HomeContent() {
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

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading account...</div>}>
      <HomeContent />
    </Suspense>
  );
}
