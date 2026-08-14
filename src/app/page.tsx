"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Clock3, Filter, Gauge, Radar } from "lucide-react";
import { PageShell, Stagger, StaggerItem } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { KpiCard, type Kpi } from "@/components/dashboard/kpi-card";
import { ActivityStream } from "@/components/dashboard/activity-stream";
import { AiQueue } from "@/components/dashboard/ai-queue";
import { AreaTrend, Bars, Donut } from "@/components/charts";
import { funnel, hourly, aiDecisions } from "@/data/analytics";
import { categories } from "@/data/categories";
import { stores } from "@/data/stores";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { clockOf, compact, int, money, moneyShort, pct } from "@/lib/utils";

const kpis: Kpi[] = [
  {
    label: "Produtos analisados",
    value: "49.455",
    delta: 12.4,
    hint: "Últimas 24 h · 5 conectores ativos",
    color: "#3b82f6",
    series: [280, 340, 310, 420, 480, 460, 540, 610, 580, 690, 720, 780],
  },
  {
    label: "Promoções encontradas",
    value: "3.210",
    delta: 8.1,
    hint: "Aprovadas nos filtros de desconto real",
    color: "var(--color-primary)",
    series: [180, 220, 200, 260, 240, 300, 320, 290, 360, 380, 410, 430],
  },
  {
    label: "Promoções enviadas",
    value: "604",
    delta: 5.6,
    hint: "3 canais do Telegram · 53 hoje",
    color: "var(--color-danger)",
    series: [28, 34, 31, 40, 44, 39, 48, 52, 49, 56, 60, 58],
  },
  {
    label: "Receita estimada",
    value: moneyShort(9741.3),
    delta: 17.2,
    hint: "Comissão consolidada dos últimos 30 dias",
    color: "#34d399",
    series: [420, 480, 510, 470, 560, 620, 680, 640, 740, 810, 880, 940],
  },
  {
    label: "CTR médio",
    value: pct(7.4),
    delta: 2.3,
    hint: "Cliques / impressões nos canais",
    color: "var(--color-primary)",
    series: [6.1, 6.4, 6.2, 6.8, 7.0, 6.9, 7.2, 7.1, 7.3, 7.5, 7.4, 7.6],
  },
  {
    label: "Conversão",
    value: pct(3.9),
    delta: 1.1,
    hint: "Pedidos confirmados por clique rastreado",
    color: "var(--color-primary)",
    series: [3.1, 3.3, 3.2, 3.5, 3.6, 3.4, 3.7, 3.8, 3.6, 3.9, 3.9, 4.0],
  },
  {
    label: "Tempo médio de análise",
    value: "1,4 s",
    delta: -18.4,
    hint: "Latência da IA por oferta avaliada",
    color: "#fbbf24",
    series: [2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.4],
    invertDelta: true,
  },
  {
    label: "Produtos ignorados",
    value: "46.245",
    delta: -4.2,
    hint: "93,5% descartados antes da IA",
    color: "#6b7280",
    series: [640, 610, 590, 620, 570, 560, 540, 520, 510, 490, 480, 470],
    invertDelta: true,
  },
];

export default function OperationsPage() {
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: storesResponse } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch("/api/v1/stores");
      const json = await res.json();
      return json.data;
    },
  });

  const currentStores = React.useMemo(() => {
    const list = storesResponse || [];
    if (list.length === 0) return stores;
    return list.map((s: any) => ({
      id: s.id,
      name: s.name,
      short: s.name.substring(0, 2).toUpperCase(),
      accent: s.accentColor || "var(--color-primary)",
      status: s.status === "ACTIVE" ? "online" : s.status === "DEGRADED" ? "degradado" : "offline",
      successRate: s.successRate ? Number(s.successRate) : 100,
      avgLatencyMs: s.avgLatencyMs || 0,
      productsFound: 1000,
      quotaUsed: s.quotaDailyUsed || 0,
      quotaLimit: s.quotaDailyLimit || 10000,
      lastSync: s.lastSyncAt ? new Date(s.lastSyncAt) : null,
    }));
  }, [storesResponse]);

  const activeStores = React.useMemo(() => {
    return currentStores.filter((s: any) => s.status === "online").length;
  }, [currentStores]);

  const currentKpis = React.useMemo(() => {
    if (!dashboardData) return kpis;
    return kpis.map((k) => {
      if (k.label === "Produtos analisados") {
        return { ...k, value: int(dashboardData.productsScanned) };
      }
      if (k.label === "Promoções encontradas") {
        return { ...k, value: int(dashboardData.offersDetected) };
      }
      if (k.label === "Promoções enviadas") {
        return { ...k, value: int(dashboardData.offersPublished) };
      }
      if (k.label === "Tempo médio de análise") {
        return { ...k, value: `${(dashboardData.avgAiLatencyMs / 1000).toFixed(1).replace(".", ",")} s` };
      }
      return k;
    });
  }, [dashboardData]);

  return (
    <PageShell>
      {/* ── Cabeçalho de comando ───────────────────────────────── */}
      <div className="relative mb-7 overflow-hidden rounded-[20px] border border-line bg-surface p-6 ">
        <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-violet/12 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-28 h-56 w-56 rounded-full bg-pink/8 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <Badge tone="primary" className="mb-3">
              <Radar className="h-3 w-3" /> Ciclo #4.812 em execução
            </Badge>
            <h1 className="text-[30px] font-semibold leading-none tracking-[-0.035em]">
              <span className="text-gradient">BeautyBot Intelligence Center</span>
            </h1>
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-fg-muted">
              Sistema monitorando ofertas automaticamente em {currentStores.length} lojas,{" "}
              {categories.filter((c) => c.active).length} categorias e 3 canais do Telegram.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-2.5">
            <StatusTile
              label="Status"
              value={
                <span className="flex items-center gap-2 text-ok">
                  <StatusDot tone="ok" /> Online
                </span>
              }
              hint={`${activeStores} de ${currentStores.length} conectores saudáveis`}
            />
            <StatusTile
              label="Última sincronização"
              value={<span className="num">{currentStores[0]?.lastSync ? clockOf(currentStores[0].lastSync) : "--:--"}</span>}
              hint="Shopee · 1.284 produtos lidos"
            />
            <StatusTile
              label="Próxima execução"
              value={<span className="num text-primary">em 2 min</span>}
              hint="Cron */15 · 5 conectores"
            />
          </div>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────── */}
      <Stagger className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {currentKpis.map((k) => (
          <StaggerItem key={k.label}>
            <KpiCard kpi={k} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* ── Gráficos principais ────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Operação nas últimas 24 horas"
            subtitle="Produtos encontrados, aprovados pela IA e efetivamente publicados"
            action={
              <div className="flex items-center gap-3 text-[11px]">
                <Legend color="#3b82f6" label="Encontradas" />
                <Legend color="var(--color-primary)" label="Aprovadas" />
                <Legend color="var(--color-danger)" label="Publicadas" />
              </div>
            }
          />
          <CardBody>
            <AreaTrend
              data={hourly}
              xKey="hour"
              height={252}
              series={[
                { key: "encontradas", name: "Encontradas", color: "#3b82f6" },
                { key: "aprovadas", name: "Aprovadas", color: "var(--color-primary)" },
                { key: "publicadas", name: "Publicadas", color: "var(--color-danger)" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Funil de qualificação"
            subtitle="De 49.455 produtos lidos a 604 publicações"
          />
          <CardBody className="space-y-3.5">
            {funnel.map((f, i) => {
              const share = (f.value / funnel[0].value) * 100;
              const colors = ["#3b82f6", "var(--color-primary)", "var(--color-primary)", "var(--color-primary)", "var(--color-danger)"];
              return (
                <div key={f.stage}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] font-medium text-fg">{f.stage}</span>
                    <span className="num text-[12.5px] font-semibold text-fg">
                      {int(f.value)}
                      <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">
                        {share.toFixed(1).replace(".", ",")}%
                      </span>
                    </span>
                  </div>
                  <Progress value={share} tone={colors[i]} className="mt-2" />
                  <p className="mt-1.5 text-[11px] text-fg-subtle">{f.hint}</p>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* ── Fila da IA + atividade ─────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" strokeWidth={2} />
                Fila da IA
                <Badge tone="primary">aguardando decisão</Badge>
              </span>
            }
            subtitle="Ofertas que passaram em todos os filtros automáticos e aguardam sua aprovação"
            action={
              <Link href="/promocoes">
                <Button variant="ghost" size="sm">
                  Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            }
          />
          <div className="pt-4">
            <AiQueue />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="pt-5">
            <ActivityStream />
          </div>
        </Card>
      </div>

      {/* ── Distribuições ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Receita por hora" subtitle="Comissão estimada · hoje" />
          <CardBody>
            <Bars
              data={hourly.filter((_, i) => i % 2 === 0)}
              xKey="hour"
              height={196}
              formatter={(v) => money(v)}
              series={[{ key: "receita", name: "Receita", color: "#34d399" }]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cliques por hora" subtitle="Tráfego rastreado nos canais" />
          <CardBody>
            <AreaTrend
              data={hourly}
              xKey="hour"
              height={196}
              series={[{ key: "cliques", name: "Cliques", color: "var(--color-primary)" }]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Decisões da IA" subtitle="Últimos 30 dias" />
          <CardBody>
            <Donut
              data={aiDecisions}
              height={196}
              center={{ value: "3.210", label: "avaliadas" }}
            />
            <div className="mt-2 flex items-center justify-center gap-4">
              {aiDecisions.map((d) => (
                <Legend key={d.label} color={d.color} label={d.label} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Categorias" subtitle="Participação na receita" />
          <CardBody>
            <Bars
              layout="vertical"
              data={categories.slice(0, 6).map((c) => ({ name: c.name, share: c.share }))}
              xKey="name"
              height={196}
              formatter={(v) => `${v}%`}
              series={[{ key: "share", name: "Participação", color: "var(--color-primary)" }]}
            />
          </CardBody>
        </Card>
      </div>

      {/* ── Saúde dos conectores ───────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader
          title="Saúde dos conectores"
          subtitle="Latência, taxa de sucesso e consumo de cota por integração"
          action={
            <Link href="/lojas">
              <Button variant="ghost" size="sm">
                Gerenciar <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {currentStores.map((s: any) => (
            <div
              key={s.id}
              className="rounded-[13px] border border-line bg-surface-2 p-3.5 transition-colors duration-200 hover:border-white/[0.13]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[10px] font-bold text-black"
                  style={{ background: s.accent }}
                >
                  {s.short}
                </span>
                <span className="truncate text-[12.5px] font-medium text-fg">{s.name}</span>
                <StatusDot
                  className="ml-auto"
                  tone={
                    s.status === "online"
                      ? "ok"
                      : s.status === "degradado"
                        ? "warn"
                        : s.status === "offline"
                          ? "danger"
                          : "neutral"
                  }
                  pulse={s.status === "online"}
                />
              </div>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <MiniRow icon={Gauge} label="Sucesso" value={pct(s.successRate)} />
                <MiniRow icon={Clock3} label="Latência" value={`${int(s.avgLatencyMs)} ms`} />
                <MiniRow icon={Filter} label="Produtos" value={compact(s.productsFound)} />
              </dl>
              <Progress
                value={(s.quotaUsed / s.quotaLimit) * 100}
                tone={s.accent}
                className="mt-3"
              />
              <p className="num mt-1.5 text-[10.5px] text-fg-subtle">
                cota {compact(s.quotaUsed)} / {compact(s.quotaLimit)}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>
    </PageShell>
  );
}

function StatusTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="min-w-[168px] rounded-[13px] border border-line bg-surface-2 px-3.5 py-3 -md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-fg">{value}</p>
      <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MiniRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-fg-subtle" strokeWidth={1.9} />
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="num ml-auto font-medium text-fg-muted">{value}</dd>
    </div>
  );
}
