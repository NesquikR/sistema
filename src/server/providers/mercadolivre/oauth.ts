import { createHash, randomBytes } from "node:crypto";
import { UnauthorizedError, UpstreamError } from "@/server/core/errors";

/**
 * Fluxo OAuth `authorization_code` do Mercado Livre.
 *
 * Necessário porque o token de aplicação (`client_credentials`) não dá acesso
 * ao catálogo: a ML restringiu `/sites/{site}/search` e devolve 403 mesmo com
 * credenciais válidas. Com o código de autorização, o token passa a
 * representar **a sua conta**, e não apenas a aplicação.
 *
 * Usa PKCE (S256). Não é opcional por capricho: sem ele, o `code` que volta na
 * URL de redirect é suficiente para outra pessoa trocar por um token, e ele
 * trafega pela barra de endereços do navegador.
 */

const AUTH_BASE: Record<string, string> = {
  MLB: "https://auth.mercadolivre.com.br",
  MLA: "https://auth.mercadolibre.com.ar",
  MLM: "https://auth.mercadolibre.com.mx",
};

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkce(): PkcePair {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  siteId?: string;
}): string {
  const base = AUTH_BASE[input.siteId?.toUpperCase() ?? "MLB"] ?? AUTH_BASE.MLB;
  const url = new URL(`${base}/authorization`);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);

  if (input.codeChallenge) {
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return url.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  userId?: string;
  scope?: string;
}

export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<TokenSet> {
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
  };

  if (input.codeVerifier) {
    params.code_verifier = input.codeVerifier;
  }

  return postToken(params);
}

/**
 * O refresh token da ML é de uso único: cada renovação devolve um novo, e o
 * anterior deixa de valer. Quem chama precisa persistir o novo valor, senão a
 * integração morre silenciosamente na renovação seguinte.
 */
export async function refreshAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenSet> {
  return postToken({
    grant_type: "refresh_token",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
  });
}

async function postToken(params: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number | string;
    scope?: string;
    message?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const detail = body.error_description || body.message || body.error || "";
    const lower = detail.toLowerCase();

    if (lower.includes("invalid_grant") || lower.includes("expired")) {
      throw new UnauthorizedError(
        `O código de autorização expirou ou já foi usado. Refaça a autorização. (${detail})`,
      );
    }
    if (lower.includes("invalid client") || lower.includes("invalid_client")) {
      throw new UnauthorizedError(
        "O Mercado Livre recusou as credenciais da aplicação. Verifique Client ID e Secret — " +
          "e, se você testou várias vezes seguidas, aguarde alguns minutos: a ML limita " +
          `emissões repetidas de token e responde com este mesmo erro. (${detail})`,
      );
    }
    if (lower.includes("redirect")) {
      throw new UnauthorizedError(
        "A URL de redirect não confere com a cadastrada no painel do Mercado Livre. " +
          `Ela precisa ser idêntica, incluindo barra final. (${detail})`,
      );
    }

    throw new UpstreamError(
      `Mercado Livre respondeu HTTP ${response.status} na troca do token: ${detail || "sem detalhe"}`,
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in ?? 21_600,
    userId: body.user_id !== undefined ? String(body.user_id) : undefined,
    scope: body.scope,
  };
}
