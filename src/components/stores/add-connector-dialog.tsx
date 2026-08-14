"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

interface CredentialField {
  id: string;
  label: string;
  type: "text" | "password" | "select";
  required: boolean;
  secret: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

interface ConnectorDefinition {
  key: string;
  storeName: string;
  storeSlug: string;
  shortLabel: string;
  accentColor: string;
  status: "disponivel" | "experimental" | "planejado";
  authFlow: "keys" | "oauth";
  description: string;
  setupSteps: string[];
  docsUrl?: string;
  credentialFields: CredentialField[];
  verificationNote?: string;
  registrado: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

type Step = "escolha" | "credenciais";

/**
 * Fluxo de instalação de conector.
 *
 * O formulário é gerado a partir do catálogo do servidor — nenhum campo é
 * escrito à mão aqui. Adicionar uma loja nova ao catálogo faz a tela existir
 * sozinha, sem tocar neste componente.
 *
 * "Testar conexão" chama a loja de verdade e não grava nada. Só depois de um
 * teste bem-sucedido o botão de instalar é liberado: assim, credencial errada
 * nunca chega ao banco.
 */
export function AddConnectorDialog({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}) {
  const [step, setStep] = React.useState<Step>("escolha");
  const [catalog, setCatalog] = React.useState<ConnectorDefinition[]>([]);
  const [encryptionOk, setEncryptionOk] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<ConnectorDefinition | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [reveal, setReveal] = React.useState<Record<string, boolean>>({});

  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [installing, setInstalling] = React.useState(false);
  const [installError, setInstallError] = React.useState<string | null>(null);
  const [authorizing, setAuthorizing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Carrega o catálogo ao abrir. Não depende do banco.
  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCatalogError(null);

    fetch("/api/v1/connectors")
      .then((r) => r.json())
      .then((body) => {
        if (!body.success) throw new Error(body.error?.message ?? "Falha ao carregar");
        setCatalog(body.data.connectors);
        setEncryptionOk(body.data.encryptionConfigured);
      })
      .catch((e: Error) => setCatalogError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  function reset() {
    setStep("escolha");
    setSelected(null);
    setValues({});
    setReveal({});
    setTestResult(null);
    setInstallError(null);
  }

  function choose(connector: ConnectorDefinition) {
    setSelected(connector);
    setTestResult(null);
    setInstallError(null);

    // Pré-seleciona a primeira opção dos campos de escolha.
    const initial: Record<string, string> = {};
    for (const field of connector.credentialFields) {
      if (field.type === "select" && field.options?.length) {
        initial[field.id] = field.options[0].value;
      } else {
        initial[field.id] = "";
      }
    }
    setValues(initial);
    setStep("credenciais");
  }

  function setValue(id: string, value: string) {
    setValues((v) => ({ ...v, [id]: value }));
    // Qualquer edição invalida o teste anterior — o resultado deixaria de
    // corresponder ao que está na tela.
    setTestResult(null);
    setInstallError(null);
  }

  const missingRequired = React.useMemo(() => {
    if (!selected) return [];
    return selected.credentialFields
      .filter((f) => f.required && !values[f.id]?.trim())
      .map((f) => f.label);
  }, [selected, values]);

  async function runTest() {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    setInstallError(null);

    try {
      const response = await fetch("/api/v1/connectors/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorKey: selected.key, credentials: values }),
      });
      const body = await response.json();

      if (!body.success) {
        setTestResult({
          ok: false,
          message: body.error?.message ?? "Falha no teste",
          latencyMs: 0,
        });
      } else {
        setTestResult(body.data);
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Falha de rede",
        latencyMs: 0,
      });
    } finally {
      setTesting(false);
    }
  }

  async function install() {
    if (!selected) return;
    setInstalling(true);
    setInstallError(null);

    try {
      const response = await fetch("/api/v1/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorKey: selected.key, credentials: values }),
      });
      const body = await response.json();

      if (!body.success) throw new Error(body.error?.message ?? "Falha ao instalar");

      onInstalled?.();
      reset();
      onClose();
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "Falha ao instalar");
    } finally {
      setInstalling(false);
    }
  }

  const noCredentialsNeeded = selected?.credentialFields.length === 0;
  const isOAuth = selected?.authFlow === "oauth";
  const canInstall = !isOAuth && (noCredentialsNeeded || Boolean(testResult?.ok));

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/connectors/oauth/callback`
      : "";

  /**
   * Autorização OAuth: leva o operador ao site da loja e volta pelo callback,
   * que conclui a instalação. Por isso não há botão "Instalar" neste fluxo —
   * quem instala é o retorno da loja.
   */
  async function authorize() {
    if (!selected) return;
    setAuthorizing(true);
    setInstallError(null);

    try {
      const response = await fetch("/api/v1/connectors/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectorKey: selected.key,
          clientId: values.client_id ?? "",
          clientSecret: values.client_secret ?? "",
          siteId: values.site_id ?? "MLB",
        }),
      });
      const body = await response.json();
      if (!body.success) throw new Error(body.error?.message ?? "Falha ao iniciar");

      window.location.href = body.data.authUrl;
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "Falha ao iniciar a autorização");
      setAuthorizing(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width={selected ? 620 : 720}
      title={
        step === "escolha" ? "Adicionar conector" : `Conectar ${selected?.storeName}`
      }
      subtitle={
        step === "escolha"
          ? "Escolha a loja que o BeautyBot vai monitorar."
          : "As chaves são testadas contra a loja antes de qualquer gravação."
      }
      footer={
        step === "credenciais" && selected ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("escolha");
                setTestResult(null);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Voltar
            </Button>

            <div className="flex-1" />

            {!noCredentialsNeeded && (
              <Button
                variant="secondary"
                size="sm"
                onClick={runTest}
                disabled={testing || missingRequired.length > 0}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Zap className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {testing ? "Testando…" : "Testar conexão"}
              </Button>
            )}

            {isOAuth ? (
              <Button
                variant="primary"
                size="sm"
                onClick={authorize}
                disabled={authorizing || missingRequired.length > 0}
              >
                {authorizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                )}
                {authorizing ? "Redirecionando…" : `Autorizar no ${selected.storeName}`}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={install}
                disabled={!canInstall || installing}
              >
                {installing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Plug className="h-3.5 w-3.5" strokeWidth={2.2} />
                )}
                {installing ? "Instalando…" : "Instalar conector"}
              </Button>
            )}
          </>
        ) : null
      }
    >
      {/*
        Sem AnimatePresence entre os passos: com `mode="wait"` o passo que sai
        ficava preso e o novo nunca montava — o formulário simplesmente não
        aparecia. A troca de `key` já remonta o bloco e dispara a animação de
        entrada, que é tudo o que um assistente de dois passos precisa.
      */}
      <div>
        {step === "escolha" ? (
          <motion.div
            key="escolha"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-fg-subtle">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando catálogo…
              </div>
            )}

            {catalogError && (
              <Callout tone="danger" title="Não foi possível carregar o catálogo">
                {catalogError}
              </Callout>
            )}

            {!loading && !catalogError && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {catalog.map((connector) => {
                  const disabled = connector.status === "planejado" || !connector.registrado;
                  return (
                    <button
                      key={connector.key}
                      disabled={disabled}
                      onClick={() => choose(connector)}
                      className={cn(
                        "group relative overflow-hidden rounded-[14px] border p-4 text-left transition-all duration-200",
                        disabled
                          ? "cursor-not-allowed border-line bg-surface-2 opacity-55"
                          : "border-line bg-surface-2 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.035]",
                      )}
                    >
                      <span
                        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-[0.18] blur-2xl"
                        style={{ background: connector.accentColor }}
                      />

                      <div className="relative flex items-start gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold text-black"
                          style={{ background: connector.accentColor }}
                        >
                          {connector.shortLabel}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                            {connector.storeName}
                          </p>
                          <p className="mt-1 text-[11.5px] leading-relaxed text-fg-subtle">
                            {connector.description}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={connector.status} />
                            {connector.credentialFields.length > 0 ? (
                              <Badge tone="neutral">
                                {connector.credentialFields.length} chave(s)
                              </Badge>
                            ) : (
                              <Badge tone="neutral">sem chaves</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          selected && (
            <motion.div
              key="credenciais"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {selected.verificationNote && (
                <Callout tone="warn" title="Sobre este conector">
                  {selected.verificationNote}
                </Callout>
              )}

              {!encryptionOk && selected.credentialFields.some((f) => f.secret) && (
                <Callout tone="danger" title="Criptografia não configurada">
                  Defina <code className="font-mono">CREDENTIALS_ENCRYPTION_KEY</code> no{" "}
                  <code className="font-mono">.env</code> e reinicie o servidor. O teste
                  funciona sem ela, mas a instalação não.
                </Callout>
              )}

              {/* Passo a passo para obter as chaves */}
              {selected.setupSteps.length > 0 && (
                <div className="rounded-[13px] border border-line bg-surface-2 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                    Como obter as chaves
                  </p>
                  <ol className="mt-2.5 space-y-1.5">
                    {selected.setupSteps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-fg-muted">
                        <span className="num mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line-strong text-[10px] text-fg-subtle">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  {selected.docsUrl && (
                    <a
                      href={selected.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary transition-colors hover:text-primary"
                    >
                      Documentação oficial
                      <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    </a>
                  )}
                </div>
              )}

              {/* URL de redirect — precisa estar cadastrada no painel da loja */}
              {isOAuth && (
                <div className="rounded-[13px] border border-violet/25 bg-violet/[0.05] p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">
                    URL de redirect
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-muted">
                    Cadastre exatamente esta URL na sua aplicação do{" "}
                    {selected.storeName}, no campo &quot;URI de redirect&quot;. Ela precisa
                    bater caractere por caractere.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-[9px] border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11.5px] text-fg">
                      {redirectUri}
                    </code>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(redirectUri);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.4} />
                      ) : (
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Campos gerados a partir do catálogo */}
              {selected.credentialFields.map((field) => (
                <div key={field.id}>
                  <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                    {field.label}
                    {field.required && <span className="text-danger">*</span>}
                    {field.secret && (
                      <ShieldCheck className="h-3 w-3 text-ok" strokeWidth={2} />
                    )}
                  </label>

                  <div className="relative mt-2">
                    {field.type === "select" ? (
                      <Select
                        className="w-full"
                        value={values[field.id] ?? ""}
                        onChange={(e) => setValue(field.id, e.target.value)}
                      >
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <>
                        <Input
                          type={
                            field.type === "password" && !reveal[field.id]
                              ? "password"
                              : "text"
                          }
                          value={values[field.id] ?? ""}
                          placeholder={field.placeholder}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          className={field.type === "password" ? "pr-10" : undefined}
                        />
                        {field.type === "password" && (
                          <button
                            type="button"
                            onClick={() =>
                              setReveal((r) => ({ ...r, [field.id]: !r[field.id] }))
                            }
                            aria-label={reveal[field.id] ? "Ocultar" : "Mostrar"}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-fg-subtle transition-colors hover:text-fg-muted"
                          >
                            {reveal[field.id] ? (
                              <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : (
                              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {field.help && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">
                      {field.help}
                    </p>
                  )}
                </div>
              ))}

              {noCredentialsNeeded && (
                <Callout tone="info" title="Sem credenciais">
                  Este conector não acessa rede e pode ser instalado diretamente.
                </Callout>
              )}

              {/* Resultado do teste */}
              <AnimatePresence>
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div
                      className={cn(
                        "flex gap-3 rounded-[13px] border p-3.5",
                        testResult.ok
                          ? "border-ok/30 bg-ok/[0.07]"
                          : "border-danger/30 bg-danger/[0.07]",
                      )}
                    >
                      <span className="mt-[2px] shrink-0">
                        {testResult.ok ? (
                          <Check className="h-4 w-4 text-ok" strokeWidth={2.4} />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-danger" strokeWidth={2.2} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[13px] font-medium",
                            testResult.ok ? "text-ok" : "text-danger",
                          )}
                        >
                          {testResult.ok
                            ? "Conexão estabelecida"
                            : "A loja recusou as credenciais"}
                          {testResult.latencyMs > 0 && (
                            <span className="num ml-2 text-[11.5px] font-normal text-fg-subtle">
                              {testResult.latencyMs} ms
                            </span>
                          )}
                        </p>
                        <p className="mt-1 break-words text-[11.5px] leading-relaxed text-fg-muted">
                          {testResult.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {installError && (
                <Callout tone="danger" title="Não foi possível instalar">
                  {installError}
                </Callout>
              )}

              {!testResult && !noCredentialsNeeded && !isOAuth && (
                <p className="text-[11.5px] leading-relaxed text-fg-subtle">
                  Teste a conexão para liberar a instalação. Nada é gravado antes disso.
                </p>
              )}

              {isOAuth && (
                <p className="text-[11.5px] leading-relaxed text-fg-subtle">
                  Ao autorizar, você sai para o {selected.storeName} e volta para cá
                  automaticamente. A loja é instalada no retorno — não há botão de
                  instalar neste fluxo.
                </p>
              )}
            </motion.div>
          )
        )}
      </div>
    </Modal>
  );
}

function StatusBadge({ status }: { status: ConnectorDefinition["status"] }) {
  if (status === "disponivel") return <Badge tone="ok">disponível</Badge>;
  if (status === "experimental") return <Badge tone="warn">experimental</Badge>;
  return <Badge tone="neutral">em breve</Badge>;
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue/25 bg-blue/[0.06] text-blue",
    warn: "border-warn/25 bg-warn/[0.06] text-warn",
    danger: "border-danger/25 bg-danger/[0.06] text-danger",
  }[tone];

  return (
    <div className={cn("rounded-[13px] border p-3.5", styles)}>
      <p className="text-[12.5px] font-medium">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{children}</p>
    </div>
  );
}
