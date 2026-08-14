import { BadRequestError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import {
  buildAuthorizationUrl,
  createPkce,
  exchangeCode,
  type TokenSet,
} from "@/server/providers/mercadolivre/oauth";
import { randomBytes } from "node:crypto";

const log = createLogger("services.oauth");

/**
 * Autorizações OAuth em andamento.
 *
 * O estado fica em memória, não no banco, por três motivos: vive por minutos,
 * contém um `codeVerifier` que não deve ser persistido, e precisa funcionar
 * antes de a loja existir — a autorização é justamente o que vem antes da
 * instalação.
 *
 * Ancorado no `globalThis` porque o hot reload do Next.js recriaria o Map no
 * meio do fluxo, e o usuário voltaria da ML para um estado que "não existe".
 */
interface PendingAuth {
  connectorKey: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  codeVerifier?: string;
  redirectUri: string;
  createdAt: number;
}

const TTL_MS = 10 * 60_000;

const globalForOauth = globalThis as unknown as {
  __beautybotPendingAuth?: Map<string, PendingAuth>;
};

const pending = globalForOauth.__beautybotPendingAuth ?? new Map<string, PendingAuth>();
globalForOauth.__beautybotPendingAuth = pending;

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [state, entry] of pending) {
    if (entry.createdAt < cutoff) pending.delete(state);
  }
}

export class OAuthService {
  /** URL de redirect que precisa estar cadastrada no painel da loja. */
  redirectUri(origin: string) {
    return `${origin.replace(/\/$/, "")}/api/v1/connectors/oauth/callback`;
  }

  start(input: {
    connectorKey: string;
    clientId: string;
    clientSecret: string;
    siteId?: string;
    origin: string;
    usePkce?: boolean;
  }) {
    sweep();

    if (input.connectorKey !== "mercadolivre-v1") {
      throw new BadRequestError(
        `O conector "${input.connectorKey}" não usa autorização OAuth.`,
      );
    }

    const state = randomBytes(24).toString("base64url");
    const pkce = input.usePkce !== false ? createPkce() : undefined;
    const redirectUri = this.redirectUri(input.origin);

    pending.set(state, {
      connectorKey: input.connectorKey,
      clientId: input.clientId.trim(),
      clientSecret: input.clientSecret.trim(),
      siteId: (input.siteId ?? "MLB").toUpperCase(),
      codeVerifier: pkce?.verifier,
      redirectUri,
      createdAt: Date.now(),
    });

    const authUrl = buildAuthorizationUrl({
      clientId: input.clientId.trim(),
      redirectUri,
      state,
      codeChallenge: pkce?.challenge,
      siteId: input.siteId,
    });

    log.info("Autorização OAuth iniciada", {
      conector: input.connectorKey,
      redirectUri,
    });

    return { authUrl, redirectUri, state };
  }

  /** Troca o código pelo token. Consome o `state`: ele vale uma única vez. */
  async complete(state: string, code: string): Promise<{
    tokens: TokenSet;
    entry: PendingAuth;
  }> {
    sweep();

    const entry = pending.get(state);
    if (!entry) {
      throw new BadRequestError(
        "Autorização não encontrada ou expirada. Ela vale por 10 minutos — recomece o processo.",
      );
    }
    pending.delete(state);

    const tokens = await exchangeCode({
      clientId: entry.clientId,
      clientSecret: entry.clientSecret,
      code,
      redirectUri: entry.redirectUri,
      codeVerifier: entry.codeVerifier,
    });

    log.success("Autorização OAuth concluída", {
      conector: entry.connectorKey,
      usuario: tokens.userId,
      temRefreshToken: Boolean(tokens.refreshToken),
    });

    return { tokens, entry };
  }

  get pendingCount() {
    sweep();
    return pending.size;
  }
}

export const oauthService = new OAuthService();
