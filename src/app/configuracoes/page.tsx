"use client";

import * as React from "react";
import {
  Bot,
  Clock3,
  Database,
  Link2,
  MessageSquare,
  Percent,
  Save,
  Send,
  Sparkles,
  Timer,
  RefreshCw,
} from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch } from "@/components/ui/controls";
import { categories as defaultCategories } from "@/data/categories";

const sections = [
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "busca", label: "Intervalo de busca", icon: Timer },
  { id: "categorias", label: "Categorias", icon: Sparkles },
  { id: "desconto", label: "Desconto mínimo", icon: Percent },
  { id: "ia", label: "IA", icon: Bot },
];

export default function ConfiguracoesPage() {
  const [active, setActive] = React.useState("telegram");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Estados locais das configurações (mapeados para as chaves do Firestore)
  const [configs, setConfigs] = React.useState({
    telegram_bot_token: "",
    telegram_bot_username: "",
    whatsapp_active: false,
    whatsapp_gateway_url: "",
    whatsapp_group_id: "",
    whatsapp_token: "",
    scheduler_interval_minutes: "15",
    min_discount_global: 35,
    ai_scorer_model: "rules",
    ai_min_publish_score: 85,
    ai_min_keep_score: 50,
    ai_validate_price_history: true,
    ai_generate_post_text: true,
    categories_config: defaultCategories,
  });

  // Carrega as configurações da API do Firestore
  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/settings");
      const data = await res.json();
      if (Array.isArray(data)) {
        const loaded: Record<string, any> = {};
        data.forEach((s) => {
          loaded[s.key] = s.value;
        });

        setConfigs((prev) => ({
          ...prev,
          telegram_bot_token: loaded.telegram_bot_token ?? "",
          telegram_bot_username: loaded.telegram_bot_username ?? "",
          whatsapp_active: loaded.whatsapp_active ?? false,
          whatsapp_gateway_url: loaded.whatsapp_gateway_url ?? "",
          whatsapp_group_id: loaded.whatsapp_group_id ?? "",
          whatsapp_token: loaded.whatsapp_token ?? "",
          scheduler_interval_minutes: String(loaded.scheduler_interval_minutes ?? "15"),
          min_discount_global: Number(loaded.min_discount_global ?? 35),
          ai_scorer_model: loaded.ai_scorer_model ?? "rules",
          ai_min_publish_score: Number(loaded.ai_min_publish_score ?? 85),
          ai_min_keep_score: Number(loaded.ai_min_keep_score ?? 50),
          ai_validate_price_history: loaded.ai_validate_price_history ?? true,
          ai_generate_post_text: loaded.ai_generate_post_text ?? true,
          categories_config: loaded.categories_config ?? defaultCategories,
        }));
      }
    } catch (e) {
      console.error("Erro ao carregar configurações:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Atualiza um campo de configuração no estado local
  const handleChange = (key: string, value: any) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  // Salva as alterações enviando requisições PUT para a API
  const handleSave = async () => {
    try {
      setSaving(true);
      const keysToSave = Object.keys(configs);
      for (const key of keysToSave) {
        let value = (configs as any)[key];
        
        // Conversão de tipos para manter consistência no Firestore
        if (key === "min_discount_global" || key === "ai_min_publish_score" || key === "ai_min_keep_score") {
          value = Number(value);
        } else if (key === "whatsapp_active" || key === "ai_validate_price_history" || key === "ai_generate_post_text") {
          value = Boolean(value);
        }

        const valueType = 
          typeof value === "boolean" ? "BOOLEAN" :
          typeof value === "number" ? "NUMBER" :
          typeof value === "object" ? "JSON" : "STRING";

        await fetch("/api/v1/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            value,
            valueType,
            scope: "GLOBAL",
            scopeId: "",
          }),
        });
      }
      alert("Configurações salvas com sucesso!");
    } catch (e) {
      console.error("Erro ao salvar configurações:", e);
      alert("Falha ao salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-fg-subtle">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-[13.5px]">Carregando configurações...</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageTitle
        title="Configurações"
        subtitle="Parâmetros operacionais do motor. As alterações passam a valer no próximo ciclo."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={fetchSettings} disabled={saving}>
              Descartar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" strokeWidth={2.2} />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[212px_minmax(0,1fr)]">
        {/* Navegação lateral das seções */}
        <nav className="lg:sticky lg:top-[84px] lg:self-start">
          <ul className="space-y-0.5">
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setActive(s.id)}
                    className={
                      "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors duration-150 " +
                      (isActive
                        ? "border border-line-strong bg-surface-2 text-fg"
                        : "border border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg")
                    }
                  >
                    <Icon
                      className={
                        "h-4 w-4 " + (isActive ? "text-primary" : "text-fg-subtle")
                      }
                      strokeWidth={1.9}
                    />
                    <span className="font-medium">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-3.5">
          {/* Telegram */}
          {active === "telegram" && (
            <Card>
              <CardHeader
                title="Telegram"
                subtitle="Credenciais do bot do Telegram"
                action={
                  <Badge tone={configs.telegram_bot_token ? "ok" : "neutral"}>
                    <StatusDot tone={configs.telegram_bot_token ? "ok" : "neutral"} />
                    {configs.telegram_bot_token ? "configurado" : "desconectado"}
                  </Badge>
                }
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Token do bot" hint="Token fornecido pelo @BotFather">
                    <Input
                      type="password"
                      value={configs.telegram_bot_token}
                      placeholder="Token do Bot Telegram"
                      onChange={(e) => handleChange("telegram_bot_token", e.target.value)}
                    />
                  </Field>
                  <Field label="Nome do bot" hint="Exibido como remetente">
                    <Input
                      value={configs.telegram_bot_username}
                      placeholder="Ex: @beautybot_oficial"
                      onChange={(e) => handleChange("telegram_bot_username", e.target.value)}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>
          )}

          {/* WhatsApp */}
          {active === "whatsapp" && (
            <Card>
              <CardHeader
                title="WhatsApp"
                subtitle="Disparo de promoções direto para Grupos do WhatsApp via API Gateway"
                action={
                  <Badge tone={configs.whatsapp_active ? "ok" : "neutral"}>
                    <StatusDot tone={configs.whatsapp_active ? "ok" : "neutral"} />
                    {configs.whatsapp_active ? "ativo" : "inativo"}
                  </Badge>
                }
              />
              <CardBody className="space-y-4">
                <div className="space-y-4">
                  <Toggle
                    label="Ativar WhatsApp"
                    hint="Enviar as ofertas aprovadas para o seu grupo do WhatsApp em tempo real."
                    checked={configs.whatsapp_active}
                    onChange={(v) => handleChange("whatsapp_active", v)}
                  />

                  <Divider />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="URL do Gateway API"
                      hint="Endpoint da Z-API ou Evolution API para envio de texto."
                    >
                      <Input
                        value={configs.whatsapp_gateway_url}
                        placeholder="Ex: https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text"
                        onChange={(e) => handleChange("whatsapp_gateway_url", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="ID do Grupo de Destino"
                      hint="Identificador do grupo (Z-API/Evolution extraem isso do link do grupo)."
                    >
                      <Input
                        value={configs.whatsapp_group_id}
                        placeholder="Ex: 12036323483984@g.us"
                        onChange={(e) => handleChange("whatsapp_group_id", e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Token de Autorização (Opcional)"
                    hint="Chave 'apikey' da Evolution API ou token de segurança extra do gateway."
                  >
                    <Input
                      type="password"
                      value={configs.whatsapp_token}
                      placeholder="Token ou apikey"
                      onChange={(e) => handleChange("whatsapp_token", e.target.value)}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Busca e agendamento */}
          {active === "busca" && (
            <Card>
              <CardHeader
                title="Intervalo de busca e agendamento"
                subtitle="Frequência dos ciclos de mineração"
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Intervalo entre ciclos" hint="Período de execução dos conectores na nuvem">
                    <Select
                      value={configs.scheduler_interval_minutes}
                      onChange={(e) => handleChange("scheduler_interval_minutes", e.target.value)}
                      className="w-full"
                    >
                      <option value="5">A cada 5 minutos</option>
                      <option value="15">A cada 15 minutos</option>
                      <option value="30">A cada 30 minutos</option>
                      <option value="60">A cada hora</option>
                    </Select>
                  </Field>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Desconto mínimo */}
          {active === "desconto" && (
            <Card>
              <CardHeader
                title="Desconto mínimo global"
                subtitle="Limiar global para ofertas"
              />
              <CardBody className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[13px] font-medium text-fg">Desconto mínimo global</p>
                    <span className="num text-[17px] font-semibold text-primary">
                      {configs.min_discount_global}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={configs.min_discount_global}
                    onChange={(e) => handleChange("min_discount_global", Number(e.target.value))}
                    className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
                    style={{
                      background: `linear-gradient(90deg, var(--color-primary) ${
                        ((configs.min_discount_global - 10) / 70) * 100
                      }%, var(--color-line) ${((configs.min_discount_global - 10) / 70) * 100}%)`,
                    }}
                  />
                  <p className="mt-2 text-[11.5px] text-fg-subtle">
                    Ofertas abaixo desse patamar são descartadas antes de chegar à IA.
                  </p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Categorias e nichos */}
          {active === "categorias" && (
            <Card>
              <CardHeader
                title="Categorias e nichos de mineração"
                subtitle="Filtros e desconto mínimo específico de cada nicho"
              />
              <CardBody className="space-y-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {configs.categories_config.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded border border-line bg-surface-2 px-3.5 py-2.5"
                    >
                      <span className="text-[15px]">{c.emoji}</span>
                      <span className="text-[12.5px] font-medium text-fg">{c.name}</span>
                      <span className="num ml-auto text-[12px] text-fg-subtle mr-2">
                        mín. {c.minDiscount}%
                      </span>
                      <Switch
                        checked={c.active}
                        onChange={(v) => {
                          const updated = configs.categories_config.map((x) =>
                            x.id === c.id ? { ...x, active: v } : x
                          );
                          handleChange("categories_config", updated);
                        }}
                        label={c.name}
                      />
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* IA */}
          {active === "ia" && (
            <Card>
              <CardHeader title="Inteligência Artificial" subtitle="Modelo e limiares de decisão da IA" />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Modelo" hint="Usado na avaliação de cada oferta">
                    <Select
                      value={configs.ai_scorer_model}
                      onChange={(e) => handleChange("ai_scorer_model", e.target.value)}
                      className="w-full"
                    >
                      <option value="rules">Somente regras (sem IA)</option>
                      <option value="v3">beautybot-scorer-v3</option>
                      <option value="v4">beautybot-scorer-v4 (Recomendado)</option>
                    </Select>
                  </Field>
                  <Field label="Score mínimo para publicar" hint="Abaixo disso vai para a fila">
                    <Input
                      type="number"
                      value={configs.ai_min_publish_score}
                      onChange={(e) => handleChange("ai_min_publish_score", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Score mínimo para manter" hint="Abaixo disso é descartada">
                    <Input
                      type="number"
                      value={configs.ai_min_keep_score}
                      onChange={(e) => handleChange("ai_min_keep_score", Number(e.target.value))}
                    />
                  </Field>
                </div>

                <Divider />

                <Toggle
                  label="Validar histórico de preços de 90 dias"
                  hint="Principal defesa contra promoções falsas com preço-âncora inflado."
                  checked={configs.ai_validate_price_history}
                  onChange={(v) => handleChange("ai_validate_price_history", v)}
                />
                <Toggle
                  label="Gerar texto da publicação com IA"
                  hint="Caso desativado, o sistema usa o template padrão de mensagem."
                  checked={configs.ai_generate_post_text}
                  onChange={(v) => handleChange("ai_generate_post_text", v)}
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12.5px] font-medium text-fg">{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-[11.5px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded border border-line bg-surface-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-fg">{label}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-subtle">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
