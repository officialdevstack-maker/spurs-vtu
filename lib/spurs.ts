import "server-only";
import { createSpursNext } from "@spurs/auth/next";

export const spurs = createSpursNext({
  publicPaths: ["/", "/login", "/api/v1", "/api/webhooks", "/api/cron", "/.well-known/spurs-business.json"],
});

export const getSpursUser = () => spurs.getUser();
export const requireSpursUser = (returnTo?: string) => spurs.requireUser(returnTo);
