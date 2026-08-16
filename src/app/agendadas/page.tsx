"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarClock, Clock3, Pause, Play, Send, X, RefreshCw } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";
import { DealThumb } from "@/components/deals/thumb";
import { storeById } from "@/data/stores";
import { categoryById } from "@/data/categories";
import { clockOf, money } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";

/** Janelas de publicação configuradas — refletem os picos de audiência. */
const windows = [
  { label: "Manhã", range: "08:00 – 10:00", load: 3, capacity: 6 },
  { label: "Almoço", range: "12:00 – 13:30", load: 5, capacity: 6 },
  { label: "Tarde", range: "16:00 – 17:30", load: 2, capacity: 6 },
  { label: "Pico noturno", range: "19:00 – 21:00", load: 6, capacity: 8 },
];

export default function AgendadasPage() {
  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ["offers", "agendada"],
    queryFn: async () => {
      const res = await fetch("/api/v1/offers?status=agendada");
      const json = await res.json();
      return json.data?.items || [];
    },
  });

  // Estados para o modal de Reagendamento
  const [reschedulingDeal, setReschedulingDeal] = React.useState<any>(null);
  const [newScheduleTime, setNewScheduleTime] = React.useState("");

  const scheduled = React.useMemo(() => {
    return [...offers].sort(
      (a: any, b: any) =>
        new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()
    );
  }, [offers]);

  // Ação: Publicar agora
  const handlePublishNow = async (dealId: string) => {
    try {
      const res = await fetch(`/api/v1/offers/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "publicada" }),
      });
      if (res.ok) {
        alert("Publicação disparada com sucesso! A oferta será enviada via fila.");
        refetch();
      } else {
        alert("Falha ao publicar a oferta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar a requisição.");
    }
  };

  // Ação: Cancelar agendamento
  const handleCancel = async (dealId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta oferta agendada?")) return;
    try {
      const res = await fetch(`/api/v1/offers/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ignorada" }),
      });
      if (res.ok) {
        alert("Agendamento cancelado com sucesso!");
        refetch();
      } else {
        alert("Falha ao cancelar a oferta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar a requisição.");
    }
  };

  // Ação: Abrir modal de reagendamento
  const handleOpenReschedule = (deal: any) => {
    setReschedulingDeal(deal);
    // Converte a data atual para formato compatível com datetime-local (YYYY-MM-DDThh:mm)
    const date = deal.scheduledFor ? new Date(deal.scheduledFor) : new Date();
    // Ajusta o timezone local para formatar a string ISO corretamente
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
    setNewScheduleTime(adjustedDate.toISOString().slice(0, 16));
  };

  // Ação: Salvar novo reagendamento
  const handleSaveReschedule = async () => {
    if (!reschedulingDeal) return;
    try {
      const res = await fetch(`/api/v1/offers/${reschedulingDeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: new Date(newScheduleTime).toISOString() }),
      });
      if (res.ok) {
        alert("Horário reagendado com sucesso!");
        setReschedulingDeal(null);
        refetch();
      } else {
        alert("Falha ao reagendar a oferta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar a requisição.");
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-fg-subtle">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-[13.5px]">Carregando agendamentos...</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageTitle
        title="Agendadas"
        subtitle="Fila de publicação futura. As ofertas são liberadas automaticamente dentro da janela escolhida."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Atualizar
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {windows.map((w) => {
          const full = w.load >= w.capacity;
          return (
            <div
              key={w.label}
              className="rounded-[14px] border border-line bg-surface px-4 py-3.5 "
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-fg">{w.label}</p>
                <Badge tone={full ? "warn" : "neutral"}>
                  {w.load}/{w.capacity}
                </Badge>
              </div>
              <p className="num mt-2 text-[16px] font-semibold tracking-[-0.02em] text-fg-muted">
                {w.range}
              </p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: w.capacity }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{
                      background: i < w.load ? (full ? "#fbbf24" : "var(--color-primary)") : "#ffffff12",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Linha do tempo de publicação"
          subtitle="Ordenada pelo horário programado"
          action={
            <span className="num text-[12px] text-fg-subtle">{scheduled.length} agendamentos</span>
          }
        />
        <CardBody>
          <div className="relative">
            <span className="absolute bottom-4 left-[58px] top-4 w-px bg-surface" />

            {scheduled.map((d: any, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.36, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex items-start gap-4 py-2.5"
              >
                <div className="w-[46px] shrink-0 pt-3.5 text-right">
                  <p className="num text-[13px] font-semibold text-fg">
                    {clockOf(d.scheduledFor!)}
                  </p>
                  <p className="text-[10.5px] text-fg-subtle">hoje</p>
                </div>

                <span className="relative z-10 mt-4 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-base bg-violet shadow-[0_0_12px_-2px_var(--color-primary)]" />

                <div className="min-w-0 flex-1 rounded-[14px] border border-line bg-surface-2 p-3.5 transition-colors duration-200 hover:border-white/[0.13]">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <DealThumb deal={d} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-fg">{d.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-subtle">
                        <span>{storeById[d.store as keyof typeof storeById]?.name || d.store}</span>
                        <span className="h-2.5 w-px bg-line-strong" />
                        <span>
                          {categoryById[d.category as keyof typeof categoryById]?.emoji || "📦"} {categoryById[d.category as keyof typeof categoryById]?.name || d.category}
                        </span>
                        <span className="h-2.5 w-px bg-line-strong" />
                        <span className="font-mono text-cyan">{d.channel}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="num text-[15px] font-semibold tracking-[-0.02em] text-fg">
                          {money(d.price)}
                        </p>
                        <p className="num text-[11px] text-fg-subtle line-through">
                          {money(d.previousPrice)}
                        </p>
                      </div>
                      <Badge tone="danger">−{d.discount}%</Badge>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Tooltip content="Publicar imediatamente">
                        <Button size="icon" variant="secondary" aria-label="Publicar agora" onClick={() => handlePublishNow(d.id)}>
                          <Send className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Reagendar">
                        <Button size="icon" variant="ghost" aria-label="Reagendar" onClick={() => handleOpenReschedule(d)}>
                          <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Cancelar agendamento">
                        <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => handleCancel(d.id)}>
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
                    <Clock3 className="h-3 w-3" strokeWidth={2} />
                    {d.aiVerdict}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Modal de Reagendamento */}
      <Modal
        open={!!reschedulingDeal}
        onClose={() => setReschedulingDeal(null)}
        title="Reagendar Oferta"
        subtitle={`Escolha a nova data e horário de publicação para: ${reschedulingDeal?.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReschedulingDeal(null)}>
              Descartar
            </Button>
            <Button variant="primary" onClick={handleSaveReschedule}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <label className="text-[12.5px] font-medium text-fg">Nova Data e Hora de Publicação</label>
          <input
            type="datetime-local"
            value={newScheduleTime}
            onChange={(e) => setNewScheduleTime(e.target.value)}
            className="w-full h-9 rounded border border-line-strong bg-surface-2 px-3 text-[13px] text-fg transition-colors duration-150 focus:border-primary focus:outline-none"
          />
        </div>
      </Modal>
    </PageShell>
  );
}

