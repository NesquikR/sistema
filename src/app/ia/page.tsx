"use client";

import { motion } from "framer-motion";
import { Bot, Brain, Cpu, Gauge, Lightbulb, ShieldCheck, Timer } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { AreaTrend, Bars, Donut } from "@/components/charts";
import { aiAccuracy, aiDecisions, rejectionReasons } from "@/data/analytics";
import { deals } from "@/data/deals";
import { DealThumb } from "@/components/deals/thumb";
import { NOW } from "@/data/stores";
import { int, money, pct, relativeTime } from "@/lib/utils";

const suggestions = [
  {
    icon: Lightbulb,
    tone: "var(--color-primary)",
    title: "Elevar o desconto mínimo de Maquiagem para 45%",
    detail:
      "Ofertas entre 40% e 45% nessa categoria converteram 1,8% — abaixo da média global de 3,9%. O corte reduziria 22% do volume e aumentaria a receita por publicação.",
    impact: "+8% de receita estimada",
  },
  {
    icon: Timer,
    tone: "var(--color-primary)",
    title: "Concentrar publicações entre 19h e 21h",
    detail:
      "O pico noturno responde por 31% dos cliques com apenas 18% das publicações. Realocar quatro slots da tarde manteria o mesmo volume diário.",
    impact: "+14% de CTR estimado",
  },
  {
    icon: ShieldCheck,
    tone: "#fb7185",
    title: "Bloquear vendedores com reputação abaixo de 4,3",
    detail:
      "Sete das nove reclamações do mês vieram de vendedores nessa faixa. O impacto no volume é de apenas 3%.",
    impact: "−78% de risco reputacional",
  },
];

export default function IaPage() {
  const evaluated = aiDecisions.reduce((a, d) => a + d.value, 0);

  return (
    <PageShell>
      <PageTitle
        title="Inteligência Artificial"
        subtitle="Camada de decisão que separa desconto real de promoção falsa e prioriza o que merece ser publicado."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Cpu className="h-3.5 w-3.5" strokeWidth={2} />
              Reprocessar fila
            </Button>
            <Button variant="primary" size="sm">
              <Brain className="h-3.5 w-3.5" strokeWidth={2.2} />
              Ajustar modelo
            </Button>
          </>
        }
      />

      {/* Cartão do modelo */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-surface shadow-[0_10px_28px_-14px_var(--color-primary)]">
            <Bot className="h-6 w-6 text-white" strokeWidth={1.9} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
              beautybot-scorer-v4
              <Badge tone="ok">produção</Badge>
            </p>
            <p className="mt-1 text-[12.5px] text-fg-subtle">
              Avalia histórico de preço, reputação do vendedor, elasticidade da categoria e
              saturação recente do canal.
            </p>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Decisões" value={int(evaluated)} hint="últimos 30 dias" />
            <Tile label="Precisão" value={pct(91.4)} hint="+2,4 p.p. no mês" accent="#34d399" />
            <Tile label="Latência média" value="1,4 s" hint="−18% no mês" accent="var(--color-primary)" />
            <Tile label="Custo" value={money(38.2)} hint="14,8 M tokens" accent="var(--color-primary)" />
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Precisão e latência"
            subtitle="Últimos 14 dias · precisão medida contra revisão manual por amostragem"
          />
          <CardBody>
            <AreaTrend
              data={aiAccuracy}
              xKey="day"
              height={228}
              series={[
                { key: "precisao", name: "Precisão (%)", color: "var(--color-primary)" },
                { key: "latencia", name: "Latência (s)", color: "var(--color-primary)" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Distribuição das decisões" subtitle="Últimos 30 dias" />
          <CardBody>
            <Donut
              data={aiDecisions}
              height={216}
              center={{ value: pct((851 / evaluated) * 100, 0), label: "aprovação" }}
            />
            <div className="mt-3 space-y-2">
              {aiDecisions.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-[12px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-fg-muted">{d.label}</span>
                  <span className="num ml-auto font-medium text-fg">{int(d.value)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Motivos de rejeição"
            subtitle="Por que 2.094 ofertas foram descartadas"
          />
          <CardBody className="space-y-3.5">
            {rejectionReasons.map((r, i) => (
              <div key={r.reason}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[12.5px] text-fg">{r.reason}</span>
                  <span className="num shrink-0 text-[12.5px] font-semibold text-fg">
                    {int(r.count)}
                    <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">
                      {pct(r.share)}
                    </span>
                  </span>
                </div>
                <Progress
                  value={r.share * 2.6}
                  tone={["#fb7185", "#fbbf24", "var(--color-primary)", "#3b82f6", "var(--color-primary)", "#6b7280"][i]}
                  className="mt-2"
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sugestões da IA"
            subtitle="Recomendações derivadas do desempenho observado"
          />
          <CardBody className="space-y-2.5">
            {suggestions.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: i * 0.07 }}
                  className="group rounded-[14px] border border-line bg-surface-2 p-3.5 transition-colors duration-200 hover:border-white/[0.13]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
                      style={{ background: `${s.tone}16`, border: `1px solid ${s.tone}33` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: s.tone }} strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-snug text-fg">{s.title}</p>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-subtle">
                        {s.detail}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Badge tone="primary">{s.impact}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Histórico de decisões"
          subtitle="Veredicto e score atribuídos a cada oferta avaliada"
        />
        <CardBody className="space-y-2">
          {deals.slice(0, 12).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3.5 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 transition-colors duration-150 hover:border-white/[0.13]"
            >
              <DealThumb deal={d} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-fg">{d.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-fg-subtle">{d.aiVerdict}</p>
              </div>
              <Badge
                tone={
                  d.status === "publicada" || d.status === "agendada"
                    ? "ok"
                    : d.status === "fila"
                      ? "primary"
                      : "neutral"
                }
              >
                {d.status === "fila" ? "aguardando" : d.status}
              </Badge>
              <span className="num w-[52px] text-right text-[12.5px] font-semibold text-fg">
                {d.aiScore}
              </span>
              <span className="num hidden w-[70px] text-right text-[11.5px] text-fg-subtle sm:block">
                {relativeTime(d.foundAt, NOW)}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </PageShell>
  );
}

function Tile({
  label,
  value,
  hint,
  accent = "#ecedf1",
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="min-w-[110px] rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        {label}
      </p>
      <p
        className="num mt-1 text-[17px] font-semibold leading-none tracking-[-0.03em]"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10.5px] text-fg-subtle">{hint}</p>
    </div>
  );
}
