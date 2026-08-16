"use client";

import * as React from "react";
import { Download, RefreshCw } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DealTable } from "@/components/deals/deal-table";
import { int, money, pct } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function PromocoesPage() {
  // Busca as ofertas reais da API
  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ["offers", "todos"],
    queryFn: async () => {
      const res = await fetch("/api/v1/offers?status=todos");
      const json = await res.json();
      return json.data?.items || [];
    },
  });

  const handleExportCsv = () => {
    if (!offers || offers.length === 0) {
      alert("Nenhuma oferta para exportar.");
      return;
    }
    const headers = ["ID", "Produto", "Marca", "Loja", "Categoria", "Preco", "Preco Anterior", "Desconto (%)", "Cupom", "Score IA", "Status", "Detectada"];
    const csvRows = offers.map((d: any) => [
      d.id,
      `"${d.title.replace(/"/g, '""')}"`,
      `"${d.brand.replace(/"/g, '""')}"`,
      d.store,
      d.category,
      d.price,
      d.previousPrice,
      d.discount,
      d.coupon ? `"${d.coupon}"` : "",
      d.aiScore,
      d.status,
      d.foundAt
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((e: any) => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `promocoes_beautybot_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avgDiscount = offers.length > 0
    ? offers.reduce((acc: number, d: any) => acc + d.discount, 0) / offers.length
    : 0;
  const totalSaved = offers.reduce((acc: number, d: any) => acc + (d.previousPrice - d.price), 0);

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-fg-subtle">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-[13.5px]">Carregando promoções...</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageTitle
        title="Promoções"
        subtitle="Todas as ofertas capturadas pelos conectores, com o veredicto da IA e o estado de publicação."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Exportar CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Atualizar
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Ofertas no catálogo" value={int(offers.length)} hint="janela de 24 h" />
        <Stat label="Desconto médio" value={pct(avgDiscount, 0)} hint="ponderado por oferta" />
        <Stat
          label="Economia agregada"
          value={money(totalSaved)}
          hint="soma das diferenças de preço"
        />
        <Stat
          label="Aguardando decisão"
          value={int(offers.filter((d: any) => d.status === "fila").length)}
          hint="fila da IA"
          accent="var(--color-primary)"
        />
      </div>

      <Card className="overflow-hidden pt-5">
        <DealTable source={offers} />
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
    <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5 ">
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

