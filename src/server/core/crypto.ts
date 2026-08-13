import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { loadEnv } from "@/server/config/env";
import { ConfigError } from "@/server/core/errors";

/**
 * Criptografia das credenciais de loja.
 *
 * AES-256-GCM, não AES-CBC: o GCM é autenticado, então adulterar o ciphertext
 * causa erro de decriptação em vez de devolver lixo silenciosamente.
 *
 * Formato armazenado: `v1.<iv>.<authTag>.<ciphertext>`, tudo em base64url. O
 * prefixo de versão existe para permitir trocar o algoritmo no futuro sem
 * precisar adivinhar como cada linha antiga foi gravada.
 *
 * A chave nunca fica no banco — vem de `CREDENTIALS_ENCRYPTION_KEY`. Quem tiver
 * um dump do Postgres não tem as credenciais das lojas.
 */

const VERSION = "v1";
const IV_BYTES = 12; // tamanho recomendado para GCM

function key(): Buffer {
  const raw = loadEnv().CREDENTIALS_ENCRYPTION_KEY;

  if (!raw) {
    throw new ConfigError(
      "CREDENTIALS_ENCRYPTION_KEY não configurada. Gere uma com:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  const buffer = Buffer.from(raw, "base64");
  if (buffer.length !== 32) {
    throw new ConfigError(
      `CREDENTIALS_ENCRYPTION_KEY deve ter 32 bytes em base64 (tem ${buffer.length}).`,
    );
  }
  return buffer;
}

export function isEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");

  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new ConfigError("Credencial em formato desconhecido ou corrompida");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Máscara para exibição: mostra o suficiente para o operador reconhecer a
 * credencial, sem revelá-la. `1234567890abcdef` → `1234••••••cdef`.
 */
export function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(6)}${value.slice(-4)}`;
}

/** Hash estável para deduplicar sem armazenar o valor. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
