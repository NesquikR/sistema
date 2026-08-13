"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, Switch } from "@/components/ui/controls";
import { Bars, Donut } from "@/components/charts";
import { categories as seed } from "@/data/categories";
import { int, money, pct } from "@/lib/utils";

export default function CategoriasPage() {
  const [items, setItems] = React.useState(seed);

  function toggle(id: string, active: boolean) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  }

  const activeCount = items.filter((c) => c.active).length;
  const revenue = items.reduce((a, c) => a + c.revenue30d, 0);

  return (
    <PageShell>
      <PageTitle
        title="Categorias"
        subtitle="Define o que o motor busca e qual desconto mínimo torna uma oferta elegível em cada nicho."
        actions={
          <Button variant="primary" size="sm">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Nova categoria
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Participação na receita" subtitle="Últimos 30 dias" />
          <CardBody>
            <Donut
              height={208}
              center={{ value: `${activeCount}`, label: "ativas" }}
              data={items.map((c) => ({ label: c.name, value: c.share, color: c.accent }))}
            />
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Receita por categoria"
            subtitle={`${money(revenue)} consolidados nos últimos 30 dias`}
          />
          <CardBody>
            <Bars
              layout="vertical"
              height={208}
              xKey="name"
              formatter={(v) => money(v)}
              data={items.map((c) => ({ name: c.name, receita: c.revenue30d }))}
              series={[{ key: "receita", name: "Receita", color: "#8b5cf6" }]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-[18px] border border-line bg-[linear-gradient(180deg,#ffffff07,#ffffff02)] p-5 backdrop-blur-xl transition-all duration-200 hover:border-white/[0.13]"
            style={{ opacity: c.active ? 1 : 0.62 }}
          >
            <span
              className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-[0.14] blur-3xl"
              style={{ background: c.accent }}
            />

            <div className="relative flex items-start gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[16px]"
                style={{ background: `${c.accent}18`, border: `1px solid ${c.accent}33` }}
              >
                {c.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-fg">{c.name}</p>
                <p className="mt-0.5 text-[11.5px] text-fg-subtle">
                  desconto mínimo {c.minDiscount}%
                </p>
              </div>
              <Switch
                checked={c.active}
                onChange={(v) => toggle(c.id, v)}
                label={`Ativar ${c.name}`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Ofertas (30 d)" value={int(c.deals30d)} />
              <Metric label="Receita" value={money(c.revenue30d)} />
              <Metric label="CTR" value={pct(c.ctr)} />
              <Metric label="Conversão" value={pct(c.conversion)} />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between text-[11.5px]">
                <span className="text-fg-subtle">Participação na receita</span>
                <span className="num font-semibold text-fg">{c.share}%</span>
              </div>
              <Progress value={c.share * 3} tone={c.accent} className="mt-2" />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Badge tone={c.trend >= 0 ? "ok" : "danger"}>
                {c.trend >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                ) : (
                  <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />
                )}
                {Math.abs(c.trend).toFixed(1).replace(".", ",")}% vs. mês anterior
              </Badge>
              {!c.active && <Badge tone="neutral">pausada</Badge>}
            </div>
          </motion.div>
        ))}
      </div>
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[11px] border border-line bg-black/20 px-3 py-2.5">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        {label}
      </p>
      <p className="num mt-1 text-[14px] font-semibold tracking-[-0.02em] text-fg">{value}</p>
    </div>
  );
}
