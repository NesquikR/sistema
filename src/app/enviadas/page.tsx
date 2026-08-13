"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCheck, MousePointerClick, Send, TrendingUp, Users } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/controls";
import { DealThumb } from "@/components/deals/thumb";
import { AreaTrend } from "@/components/charts";
import { deals } from "@/data/deals";
import { channels } from "@/data/logs";
import { hourly } from "@/data/analytics";
import { NOW, storeById } from "@/data/stores";
import { compact, dateTimeOf, int, money, pct, relativeTime } from "@/lib/utils";

export default function EnviadasPage() {
  const published = deals.filter((d) => d.status === "publicada");
  const [channel, setChannel] = React.useState<string>("todos");

  const rows = published.filter((d) => channel === "todos" || d.channel === channel);

  const clicks = published.reduce((a, d) => a + (d.clicks ?? 0), 0);
  const conversions = published.reduce((a, d) => a + (d.conversions ?? 0), 0);
  const revenue = published.reduce((a, d) => a + (d.revenue ?? 0), 0);

  return (
    <PageShell>
      <PageTitle
        title="Enviadas"
        subtitle="Histórico de publicações no Telegram com desempenho de cliques, conversões e receita atribuída."
        actions={
          <Segmented
            value={channel}
            onChange={setChannel}
            options={[
              { value: "todos", label: "Todos" },
              ...channels
                .filter((c) => c.active)
                .map((c) => ({ value: c.handle, label: c.name.replace("BeautyBot · ", "") })),
            ]}
          />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Metric icon={Send} label="Publicações" value={int(published.length)} hint="últimas 24 h" color="#8b5cf6" />
        <Metric icon={MousePointerClick} label="Cliques" value={compact(clicks)} hint={`CTR ${pct(7.4)}`} color="#22d3ee" />
        <Metric icon={CheckCheck} label="Conversões" value={int(conversions)} hint={`taxa ${pct((conversions / clicks) * 100)}`} color="#34d399" />
        <Metric icon={TrendingUp} label="Receita atribuída" value={money(revenue)} hint="comissão estimada" color="#ec4899" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cliques e receita por hora" subtitle="Desempenho consolidado das publicações de hoje" />
          <CardBody>
            <AreaTrend
              data={hourly}
              xKey="hour"
              height={216}
              series={[
                { key: "cliques", name: "Cliques", color: "#22d3ee" },
                { key: "receita", name: "Receita", color: "#34d399" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Canais" subtitle="Audiência e desempenho por destino" />
          <CardBody className="space-y-2.5">
            {channels.map((c) => (
              <div
                key={c.id}
                className="rounded-[13px] border border-line bg-black/20 p-3.5 transition-colors hover:border-white/[0.13]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-fg">{c.name}</span>
                  <Badge tone={c.active ? "ok" : "neutral"} className="ml-auto">
                    {c.active ? "ativo" : "pausado"}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-[11.5px] text-fg-subtle">{c.handle}</p>
                <div className="mt-3 flex items-center gap-4 text-[11.5px]">
                  <span className="num flex items-center gap-1.5 text-fg-muted">
                    <Users className="h-3 w-3 text-fg-subtle" strokeWidth={2} />
                    {compact(c.members)}
                  </span>
                  <span className="num text-fg-muted">{c.postsToday} posts hoje</span>
                  <span className="num ml-auto font-medium text-cyan">CTR {pct(c.ctr)}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card glow>
        <CardHeader
          title="Publicações"
          subtitle="Mensagem exatamente como foi entregue ao canal"
          action={<span className="num text-[12px] text-fg-subtle">{rows.length} registros</span>}
        />
        <CardBody className="space-y-2.5">
          {rows.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: Math.min(i * 0.03, 0.3) }}
              className="group grid grid-cols-1 gap-4 rounded-[14px] border border-line bg-black/20 p-4 transition-colors duration-200 hover:border-white/[0.13] lg:grid-cols-[minmax(0,1fr)_300px]"
            >
              <div className="flex gap-3.5">
                <DealThumb deal={d} size={64} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-fg">{d.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-subtle">
                    <span className="font-mono text-cyan">{d.channel}</span>
                    <span className="h-2.5 w-px bg-line-strong" />
                    <span>{storeById[d.store].name}</span>
                    <span className="h-2.5 w-px bg-line-strong" />
                    <span title={dateTimeOf(d.publishedAt!)}>
                      {relativeTime(d.publishedAt!, NOW)}
                    </span>
                  </p>
                  <pre className="mt-2.5 whitespace-pre-wrap rounded-[10px] border border-line bg-black/35 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-fg-muted">
                    {d.message}
                  </pre>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 self-start lg:border-l lg:border-line lg:pl-4">
                <Cell label="Cliques" value={int(d.clicks ?? 0)} color="#22d3ee" />
                <Cell label="Conversões" value={int(d.conversions ?? 0)} color="#34d399" />
                <Cell label="Receita" value={money(d.revenue ?? 0)} color="#ec4899" />
              </div>
            </motion.div>
          ))}
        </CardBody>
      </Card>
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-[linear-gradient(180deg,#ffffff06,#ffffff02)] px-4 py-3.5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-[7px]"
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}
        >
          <Icon className="h-3 w-3" style={{ color }} strokeWidth={2.1} />
        </span>
        <p className="text-[11.5px] font-medium text-fg-muted">{label}</p>
      </div>
      <p className="num mt-2.5 text-[21px] font-semibold leading-none tracking-[-0.03em] text-fg">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-white/[0.02] px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-fg-subtle">{label}</p>
      <p className="num mt-1 text-[13.5px] font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
