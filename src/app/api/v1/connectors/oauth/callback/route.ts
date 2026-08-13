import type { NextRequest } from "next/server";
import { normalizeError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { bootstrap } from "@/server/bootstrap";
import { connectorService } from "@/server/services/connector.service";
import { oauthService } from "@/server/services/oauth.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("http.oauth-callback");

/**
 * GET /api/v1/connectors/oauth/callback
 *
 * Aqui quem chega é o **navegador**, vindo do Mercado Livre — não um cliente
 * de API. Por isso a resposta é HTML, e não JSON: o operador precisa ver o
 * resultado numa página, não um objeto cru.
 *
 * A autorização e a instalação são reportadas separadamente. Autorizar com
 * sucesso e falhar ao gravar (banco fora, por exemplo) é um estado real, e
 * dizer só "deu erro" faria o operador refazer uma autorização que funcionou.
 */
export async function GET(request: NextRequest) {
  await bootstrap("web");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return page({
      ok: false,
      title: "Autorização negada",
      message: errorDescription || error,
      hint: "Você recusou a autorização, ou o Mercado Livre a interrompeu. Pode tentar de novo.",
    });
  }

  if (!code || !state) {
    return page({
      ok: false,
      title: "Retorno incompleto",
      message: "O Mercado Livre não enviou o código de autorização.",
      hint: "Recomece a partir de Lojas › Adicionar conector.",
    });
  }

  let tokens;
  let entry;

  try {
    const result = await oauthService.complete(state, code);
    tokens = result.tokens;
    entry = result.entry;
  } catch (e) {
    const err = normalizeError(e);
    log.error("Falha ao concluir autorização", { error: err });
    return page({
      ok: false,
      title: "Não foi possível concluir a autorização",
      message: err.message,
      hint: "Recomece a partir de Lojas › Adicionar conector.",
    });
  }

  // Autorização concluída. A partir daqui, falha é de gravação.
  try {
    const store = await connectorService.install({
      connectorKey: entry.connectorKey,
      credentials: {
        client_id: entry.clientId,
        client_secret: entry.clientSecret,
        site_id: entry.siteId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? "",
        user_id: tokens.userId ?? "",
      },
      // Já validamos com a própria ML ao trocar o código pelo token.
      skipTest: true,
    });

    return page({
      ok: true,
      title: "Loja conectada",
      message: `${store.name} foi instalada e já aparece em Lojas.`,
      hint: tokens.userId ? `Conta autorizada: ${tokens.userId}` : undefined,
    });
  } catch (e) {
    const err = normalizeError(e);
    log.error("Autorização concluída, mas a instalação falhou", { error: err });

    return page({
      ok: false,
      title: "Autorizado, mas não foi possível salvar",
      message: err.message,
      hint:
        "A autorização com o Mercado Livre funcionou — o problema foi ao gravar no banco. " +
        "Verifique se o PostgreSQL está de pé e refaça a autorização.",
    });
  }
}

function page(input: {
  ok: boolean;
  title: string;
  message: string;
  hint?: string;
}) {
  const accent = input.ok ? "#34d399" : "#fb7185";

  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.title)} · BeautyBot</title>
<style>
  *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;
    background:#07070a;color:#ecedf1;font-family:"Segoe UI",-apple-system,system-ui,sans-serif;
    padding:24px;letter-spacing:-.011em}
  .card{max-width:520px;width:100%;border:1px solid #ffffff14;border-radius:18px;
    background:linear-gradient(180deg,#ffffff07,#ffffff02);padding:32px;
    box-shadow:0 40px 90px -40px #000}
  .dot{width:10px;height:10px;border-radius:99px;background:${accent};
    box-shadow:0 0 16px ${accent}77;display:inline-block;margin-right:10px}
  h1{font-size:19px;margin:0 0 12px;font-weight:600;letter-spacing:-.02em}
  p{margin:0 0 10px;font-size:13.5px;line-height:1.65;color:#9aa0ad}
  .hint{font-size:12.5px;color:#6b7280;border-top:1px solid #ffffff0d;padding-top:14px;margin-top:18px}
  a{display:inline-block;margin-top:20px;padding:9px 16px;border-radius:10px;
    background:linear-gradient(180deg,#8b5cf6,#7c3aed);color:#fff;text-decoration:none;
    font-size:13px;font-weight:500}
</style></head>
<body><div class="card">
  <h1><span class="dot"></span>${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.message)}</p>
  ${input.hint ? `<p class="hint">${escapeHtml(input.hint)}</p>` : ""}
  <a href="/lojas">Voltar para Lojas</a>
</div></body></html>`;

  return new Response(html, {
    status: input.ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** O texto vem da ML e do usuário: nunca é injetado cru no HTML. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
