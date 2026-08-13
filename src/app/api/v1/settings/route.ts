import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, parseQuery, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { settingService } from "@/server/services/setting.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const scopeEnum = z.enum(["GLOBAL", "STORE", "CATEGORY", "CHANNEL", "USER"]);

const listQuery = z.object({ scope: scopeEnum.optional() });

const upsertBody = z.object({
  key: z.string().min(2).max(120),
  value: z.unknown(),
  scope: scopeEnum.default("GLOBAL"),
  scopeId: z.string().default(""),
  valueType: z
    .enum(["STRING", "NUMBER", "BOOLEAN", "JSON", "SECRET", "DURATION", "PERCENT"])
    .optional(),
  description: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
});

/** GET /api/v1/settings — segredos nunca saem com o valor. */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const { scope } = parseQuery(request, listQuery);
  const settings = await settingService.list(scope);

  return ok(
    settings.map((s) => ({
      ...s,
      value: s.isSecret ? "••••••••" : s.value,
      defaultValue: s.isSecret ? null : s.defaultValue,
    })),
  );
}, { name: "GET /api/v1/settings" });

/** PUT /api/v1/settings — upsert com registro em SettingHistory. */
export const PUT = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, upsertBody);

  const saved = await settingService.set({
    key: body.key,
    value: body.value as never,
    scope: body.scope,
    scopeId: body.scopeId,
    valueType: body.valueType,
    description: body.description,
    reason: body.reason,
  });

  return ok(saved);
}, { name: "PUT /api/v1/settings" });
