"use client";

import * as React from "react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { AreaTrend, Bars, Donut } from "@/components/charts";
import { Download } from "lucide-react";
import {
  hourly,
  last30Days,
  type DayPoint,
  type HourPoint,
} from "@/data/analytics";
import { categories } from "@/data/categories";
import { stores } from "@/data/stores";
import { deals } from "@/data/deals";
import { compact, int, money, moneyShort, pct } from "@/lib/utils";

type Range = "24h" | "7d" | "30d";

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<Range>("30d");

  const series: (HourPoint | DayPoint)[] =
    range === "24h" ? hourly : last30Days.slice(range === "7d" ? -7 : 0);
  const xKey = range === "24h" ? "hour" : "day";

  const revenue = last30Days.reduce((a, d) => a + d.receita, 0);
  const clicks = last30Days.reduce((a, d) => a + d.cliques, 0);
  const posts = last30Days.reduce((a, d) => a + d.publicadas, 0);

  const topDeals = [...deals]
    .filter((d) => d.revenue)
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 8);

  return (
    <PageShell>
      <PageTitle
        title="Analytics"
        subtitle="Desempenho consolidado do funil: descoberta, aprovação, publicação e receita."
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "24h", label: "24 h" },
                { value: "7d", label: "7 dias" },
                { value: "30d", label: "30 dias" },
              ]}
            />
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Exportar
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Big label="Receita" value={moneyShort(revenue)} hint="30 dias" delta={17.2} />
        <Big label="Cliques" value={compact(clicks)} hint="tráfego rastreado" delta={9.4} />
        <Big label="Publicações" value={int(posts)} hint="3 canais" delta={5.6} />
        <Big
          label="Receita por publicação"
          value={money(revenue / posts)}
          hint="ticket médio de comissão"
          delta={11.1}
        />
      </div>

      <Card glow className="mb-5">
        <CardHeader
          title="Receita e cliques"
          subtitle={
            range === "24h"
              ? "Distribuição horária de hoje"
              : `Evolução diária · ${range === "7d" ? "últimos 7" : "últimos 30"} dias`
          }
          action={
            <div className="flex items-center gap-3 text-[11px]">
              <Legend color="#34d399" label="Receita" />
              <Legend color="#22d3ee" label="Cliques" />
            </div>
          }
        />
        <CardBody>
          <AreaTrend
            data={series}
            xKey={xKey}
            height={272}
            series={
              range === "24h"
                ? [
                    { key: "receita", name: "Receita", color: "#34d399" },
                    { key: "cliques", name: "Cliques", color: "#22d3ee" },
                  ]
                : [
                    { key: "receita", name: "Receita", color: "#34d399" },
                    { key: "cliques", name: "Cliques", color: "#22d3ee" },
                  ]
            }
          />
        </CardBody>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader title="Conversão" subtitle="Pedidos por clique rastreado" />
          <CardBody>
            <AreaTrend
              data={last30Days}
              xKey="day"
              height={196}
              formatter={(v) => pct(v)}
              series={[{ key: "conversao", name: "Conversão", color: "#a78bfa" }]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Publicações por dia" subtitle="Volume enviado ao Telegram" />
          <CardBody>
            <Bars
              data={last30Days.slice(-14)}
              xKey="day"
              height={196}
              series={[{ key: "publicadas", name: "Publicações", color: "#ec4899" }]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Receita por loja" subtitle="Participação por integração" />
          <CardBody>
            <Donut
              height={196}
              center={{ value: moneyShort(revenue), label: "30 dias" }}
              data={stores.map((s) => ({
                label: s.name,
                value: s.dealsApproved,
                color: s.accent,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="CTR por categoria" subtitle="Cliques sobre impressões" />
          <CardBody>
            <Bars
              layout="vertical"
              height={196}
              xKey="name"
              formatter={(v) => pct(v)}
              data={categories.map((c) => ({ name: c.name, ctr: c.ctr }))}
              series={[{ key: "ctr", name: "CTR", color: "#22d3ee" }]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Ofertas com melhor desempenho"
          subtitle="Ordenadas por receita atribuída no período"
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["#", "Produto", "Categoria", "Cliques", "Conversões", "Taxa", "Receita"].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {topDeals.map((d, i) => (
                  <tr
                    key={d.id}
                    className="border-b border-line/70 transition-colors hover:bg-white/[0.028]"
                  >
                    <td className="num py-2.5 pr-4 text-[12px] text-fg-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="max-w-[280px] truncate pr-4 text-[12.5px] font-medium text-fg">
                      {d.title}
                    </td>
                    <td className="pr-4 text-[12.5px] text-fg-muted">
                      {categories.find((c) => c.id === d.category)?.name}
                    </td>
                    <td className="num pr-4 text-[12.5px] text-fg-muted">{int(d.clicks ?? 0)}</td>
                    <td className="num pr-4 text-[12.5px] text-fg-muted">
                      {int(d.conversions ?? 0)}
                    </td>
                    <td className="pr-4">
                      <Badge tone="violet">
                        {pct(((d.conversions ?? 0) / (d.clicks ?? 1)) * 100)}
                      </Badge>
                    </td>
                    <td className="num pr-1 text-[12.5px] font-semibold text-ok">
                      {money(d.revenue ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </PageShell>
  );
}

function Big({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  delta: number;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-[linear-gradient(180deg,#ffffff07,#ffffff02)] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-fg-muted">{label}</p>
        <Badge tone={delta >= 0 ? "ok" : "danger"}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1).replace(".", ",")}%
        </Badge>
      </div>
      <p className="num mt-3 text-[26px] font-semibold leading-none tracking-[-0.035em] text-fg">
        {value}
      </p>
      <p className="mt-2 text-[11.5px] text-fg-subtle">{hint}</p>
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
