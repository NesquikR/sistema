"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Package,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageShell, PageTitle, Stagger, StaggerItem } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, Tooltip } from "@/components/ui/controls";
import { AddConnectorDialog } from "@/components/stores/add-connector-dialog";
import { Sparkline } from "@/components/charts";
import { NOW } from "@/data/stores";
import { clockOf, compact, int, pct, relativeTime } from "@/lib/utils";
import type { StoreStatus } from "@/types";

const statusMeta: Record<
  StoreStatus,
  { tone: "ok" | "warn" | "danger" | "neutral"; label: string }
> = {
  online: { tone: "ok", label: "Operacional" },
  degradado: { tone: "warn", label: "Degradado" },
  offline: { tone: "danger", label: "Indisponível" },
  pausado: { tone: "neutral", label: "Pausado" },
};

export default function LojasPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [realStores, setRealStores] = React.useState<any[]>([]);

  const fetchStores = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/stores");
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        setRealStores(body.data);
      }
    } catch (e) {
      console.error("Erro ao buscar lojas:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir esta loja? Esta ação removerá as credenciais e o conector do sistema.")) return;
    try {
      const res = await fetch(`/api/v1/stores/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Falha ao excluir");
      
      // Atualiza a lista após exclusão bem sucedida
      fetchStores();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir a loja");
    }
  }

  return (
    <PageShell>
      <PageTitle
        title="Lojas"
        subtitle="Cada integração é um conector isolado. Falhas em uma loja não interrompem as demais."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={fetchStores}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
              Atualizar lista
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              Adicionar conector
            </Button>
          </>
        }
      />

      <AddConnectorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onInstalled={fetchStores}
      />

      {loading && realStores.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-fg-subtle">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-[13.5px]">Carregando lojas...</span>
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
          {realStores.map((store) => {
            // Mapeia do banco Firestore para a interface do frontend
            const s = {
              id: store.id,
              name: store.name,
              short: store.name.substring(0, 2).toUpperCase(),
              accent: store.accentColor || "var(--color-primary)",
              status: store.status === "ACTIVE" ? "online" : 
                      store.status === "DEGRADED" ? "degradado" : 
                      store.status === "OFFLINE" ? "offline" : "pausado",
              lastSync: store.lastSyncAt ? new Date(store.lastSyncAt).toISOString() : new Date().toISOString(),
              nextSync: store.nextSyncAt ? new Date(store.nextSyncAt).toISOString() : new Date().toISOString(),
              productsFound: 0,
              dealsApproved: 0,
              errors24h: store.consecutiveFailures || 0,
              avgLatencyMs: store.avgLatencyMs || 0,
              successRate: store.successRate ? Number(store.successRate) * 100 : 100,
              quotaUsed: store.quotaDailyUsed || 0,
              quotaLimit: store.quotaDailyLimit || 10000,
              connector: store.connectorKey,
              throughput: [10, 15, 20, 18, 25, 30, 22, 28, 35, 40, 32, 45],
            };

            const meta = statusMeta[s.status as StoreStatus] || { tone: "neutral", label: "Desconhecido" };
            const quota = (s.quotaUsed / s.quotaLimit) * 100;
            return (
              <StaggerItem key={s.id}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 360, damping: 26 }}
                  className="group relative h-full overflow-hidden rounded-[18px] border border-line bg-surface  transition-colors duration-200 hover:border-white/[0.13]"
                >
                  <span
                    className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.16] blur-3xl transition-opacity duration-300 group-hover:opacity-25"
                    style={{ background: s.accent }}
                  />

                  <div className="relative flex items-start gap-3 p-5 pb-4">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[13px] font-bold text-black"
                      style={{ background: s.accent, boxShadow: `0 8px 22px -12px ${s.accent}` }}
                    >
                      {s.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium tracking-[-0.01em] text-fg">{s.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-fg-subtle">{s.connector}</p>
                    </div>
                    <Badge tone={meta.tone === "neutral" ? "neutral" : meta.tone}>
                      <StatusDot tone={meta.tone} pulse={s.status === "online"} />
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="px-5">
                    <div className="h-[52px] opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                      <Sparkline data={s.throughput} color={s.accent} height={52} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-5 pt-4">
                    <Field
                      icon={Clock3}
                      label="Última sincronização"
                      value={s.lastSync ? `${clockOf(s.lastSync)} · ${relativeTime(s.lastSync, NOW)}` : "Nunca"}
                    />
                    <Field
                      icon={RefreshCw}
                      label="Próxima execução"
                      value={
                        s.status === "pausado" ? "—" : `${clockOf(s.nextSync)}`
                      }
                    />
                    <Field icon={Package} label="Produtos encontrados" value={compact(s.productsFound)} />
                    <Field icon={CheckCircle2} label="Ofertas aprovadas" value={int(s.dealsApproved)} />
                    <Field
                      icon={AlertTriangle}
                      label="Erros (24 h)"
                      value={int(s.errors24h)}
                      tone={s.errors24h > 5 ? "#fb7185" : s.errors24h > 0 ? "#fbbf24" : undefined}
                    />
                    <Field
                      icon={Clock3}
                      label="Tempo médio"
                      value={`${int(s.avgLatencyMs)} ms`}
                      tone={s.avgLatencyMs > 1500 ? "#fbbf24" : undefined}
                    />
                  </div>

                  <div className="border-t border-line px-5 py-4">
                    <div className="flex items-baseline justify-between text-[11.5px]">
                      <span className="text-fg-subtle">Taxa de sucesso</span>
                      <span className="num font-semibold text-fg">{pct(s.successRate)}</span>
                    </div>
                    <Progress value={s.successRate} tone={s.accent} className="mt-2" />

                    <div className="mt-3.5 flex items-baseline justify-between text-[11.5px]">
                      <span className="text-fg-subtle">Cota da API</span>
                      <span className="num font-medium text-fg-muted">
                        {compact(s.quotaUsed)} / {compact(s.quotaLimit)}
                      </span>
                    </div>
                    <Progress
                      value={quota}
                      tone={quota > 85 ? "#fb7185" : quota > 65 ? "#fbbf24" : "#34d399"}
                      className="mt-2"
                    />
                  </div>

                  <div className="flex items-center gap-2 border-t border-line px-5 py-3.5">
                    <Button variant="secondary" size="sm">
                      <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                      Sincronizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s.id)}
                      className="text-red-400/80 hover:text-red-400 hover:bg-red-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" strokeWidth={2} />
                      Excluir
                    </Button>
                    <Tooltip content="Interface padrão StoreConnector">
                      <Badge tone="primary" className="ml-auto">
                        <Plug className="h-3 w-3" /> v2
                      </Badge>
                    </Tooltip>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}

          {/* Slot para nova integração */}
          <StaggerItem>
            <button
              onClick={() => setDialogOpen(true)}
              className="group flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-line-strong bg-white/[0.012] p-8 text-center transition-colors duration-200 hover:border-violet/40 hover:bg-violet/[0.04]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-line-strong bg-white/[0.04] transition-colors group-hover:border-violet/40 group-hover:bg-violet/10">
                <Plus className="h-5 w-5 text-fg-subtle transition-colors group-hover:text-primary" strokeWidth={2} />
              </span>
              <span className="text-[13.5px] font-medium text-fg">Adicionar conector</span>
              <span className="max-w-[260px] text-[12px] leading-relaxed text-fg-subtle">
                Implemente a interface <code className="font-mono text-primary">StoreConnector</code> e
                a loja passa a participar de todos os ciclos automaticamente.
              </span>
            </button>
          </StaggerItem>
        </Stagger>
      )}
    </PageShell>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        <Icon className="h-3 w-3" strokeWidth={2} />
        {label}
      </p>
      <p
        className="num mt-1 text-[13px] font-medium text-fg"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
