import { spurs } from "@/lib/spurs";

export const proxy = spurs.proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}