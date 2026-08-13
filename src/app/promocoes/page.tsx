"use client";

import { Download, Flame } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DealTable } from "@/components/deals/deal-table";
import { deals } from "@/data/deals";
import { int, money, pct } from "@/lib/utils";

export default function PromocoesPage() {
  const avgDiscount =
    deals.reduce((acc, d) => acc + d.discount, 0) / deals.length;
  const totalSaved = deals.reduce((acc, d) => acc + (d.previousPrice - d.price), 0);

  return (
    <PageShell>
      <PageTitle
        title="Promoções"
        subtitle="Todas as ofertas capturadas pelos conectores, com o veredicto da IA e o estado de publicação."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Exportar CSV
            </Button>
            <Button variant="primary" size="sm">
              <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
              Nova varredura
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Ofertas no catálogo" value={int(deals.length)} hint="janela de 24 h" />
        <Stat label="Desconto médio" value={pct(avgDiscount, 0)} hint="ponderado por oferta" />
        <Stat
          label="Economia agregada"
          value={money(totalSaved)}
          hint="soma das diferenças de preço"
        />
        <Stat
          label="Aguardando decisão"
          value={int(deals.filter((d) => d.status === "fila").length)}
          hint="fila da IA"
          accent="#8b5cf6"
        />
      </div>

      <Card glow className="overflow-hidden pt-5">
        <DealTable source={deals} />
      </Card>
    </PageShell>
  );
}

function Stat({
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
    <div className="rounded-[14px] border border-line bg-[linear-gradient(180deg,#ffffff06,#ffffff02)] px-4 py-3.5 backdrop-blur-xl">
      <p className="text-[11.5px] font-medium text-fg-muted">{label}</p>
      <p
        className="num mt-2 text-[21px] font-semibold leading-none tracking-[-0.03em]"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}
