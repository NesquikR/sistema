import { z } from "zod";

/**
 * Configuração centralizada.
 *
 * O processo falha no boot — e não na primeira requisição — quando uma variável
 * obrigatória está ausente ou malformada. Descobrir que `DATABASE_URL` estava
 * errada quando o primeiro job de publicação roda às 3h da manhã é o tipo de
 * erro que este arquivo existe para eliminar.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .refine((v) => !v || v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL deve ser uma connection string PostgreSQL",
    })
    .optional(),

  FIREBASE_PROJECT_ID: z.string().default("sistema-grupo"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  /** Segredos de conectores em store_credentials (AES-256-GCM, 32 bytes em base64). */
  CREDENTIALS_ENCRYPTION_KEY: z.string().default(""),
  /** Salt do hash de IP em clicks. IP em claro nunca é persistido (LGPD). */
  CLICK_IP_SALT: z.string().default(""),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  /** Persistir logs na tabela `logs` além do stdout. */
  LOG_PERSIST: z.coerce.boolean().default(true),

  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),

  // Runtime de background (processo separado do servidor web)
  SCHEDULER_ENABLED: z.coerce.boolean().default(true),
  SCHEDULER_TICK_MS: z.coerce.number().int().min(1000).default(15_000),
  QUEUE_ENABLED: z.coerce.boolean().default(true),
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  QUEUE_POLL_MS: z.coerce.number().int().min(200).default(2_000),
  QUEUE_STALE_LOCK_MS: z.coerce.number().int().min(10_000).default(300_000),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  · ${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuração inválida:\n${details}\n`);
  }

  cached = parsed.data;
  return cached;
}

/** Apenas para testes: descarta o cache entre cenários. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => loadEnv().NODE_ENV === "production";
export const isDevelopment = () => loadEnv().NODE_ENV === "development";
