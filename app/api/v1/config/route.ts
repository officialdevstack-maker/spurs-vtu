import { apiOk } from "@/lib/api/response";

export async function GET() {
  return apiOk({
    minimumVersion: process.env.MINIMUM_APP_VERSION ?? null,
    maintenance: process.env.MAINTENANCE_MODE === "true",
    maintenanceMessage: process.env.MAINTENANCE_MESSAGE ?? null,
  });
}
