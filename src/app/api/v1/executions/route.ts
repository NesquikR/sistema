import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseQuery, withApiHandler } from "@/server/http/handler";
import { paginated } from "@/server/http/responses";
import { executionService } from "@/server/services/execution.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({
  jobId: z.string().optional(),
  storeId: z.string().optional(),
  status: z
    .enum(["PENDING", "RUNNING", "SUCCESS", "PARTIAL", "FAILED", "CANCELLED", "TIMEOUT"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/v1/executions */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const q = parseQuery(request, query);
  return paginated(await executionService.list(q));
}, { name: "GET /api/v1/executions" });
