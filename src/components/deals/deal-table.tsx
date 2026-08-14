"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, Star, Ticket, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchInput, Select } from "@/components/ui/controls";
import { DealThumb } from "@/components/deals/thumb";
import { categories, categoryById } from "@/data/categories";
import { stores, storeById } from "@/data/stores";
import { NOW } from "@/data/stores";
import { cn, dateTimeOf, int, money, relativeTime } from "@/lib/utils";
import type { Deal, DealStatus } from "@/types";

const statusTone: Record<DealStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  fila: "primary",
  aprovada: "blue",
  agendada: "blue",
  publicada: "ok",
  ignorada: "neutral",
  expirada: "warn",
};

const statusLabel: Record<DealStatus, string> = {
  fila: "Na fila",
  aprovada: "Aprovada",
  agendada: "Agendada",
  publicada: "Publicada",
  ignorada: "Ignorada",
  expirada: "Expirada",
};

type SortKey = "foundAt" | "discount" | "price" | "aiScore";

export function DealTable({ source }: { source: Deal[] }) {
  const [q, setQ] = React.useState("");
  const [store, setStore] = React.useState("todas");
  const [category, setCategory] = React.useState("todas");
  const [status, setStatus] = React.useState("todos");
  const [sort, setSort] = React.useState<SortKey>("foundAt");
  const [dir, setDir] = React.useState<1 | -1>(-1);

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = source.filter((d) => {
      if (term && !`${d.title} ${d.brand} ${d.id}`.toLowerCase().includes(term)) return false;
      if (store !== "todas" && d.store !== store) return false;
      if (category !== "todas" && d.category !== category) return false;
      if (status !== "todos" && d.status !== status) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const va = sort === "foundAt" ? new Date(a.foundAt).getTime() : (a[sort] as number);
      const vb = sort === "foundAt" ? new Date(b.foundAt).getTime() : (b[sort] as number);
      return (va - vb) * dir;
    });
  }, [source, q, store, category, status, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(-1);
    }
  }

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2.5 px-5 pb-4">
        <SearchInput
          className="w-full sm:w-[300px]"
          placeholder="Buscar por produto, marca ou ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="todas">Todas as lojas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(statusLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <span className="num ml-auto text-[12px] text-fg-subtle">
          {rows.length} de {source.length} ofertas
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead>
            <tr className="border-y border-line bg-white/[0.015]">
              <Th className="pl-5">Produto</Th>
              <Th>Loja</Th>
              <Th>Categoria</Th>
              <Th sortable active={sort === "price"} onClick={() => toggleSort("price")}>
                Preço
              </Th>
              <Th>Anterior</Th>
              <Th sortable active={sort === "discount"} onClick={() => toggleSort("discount")}>
                Desconto
              </Th>
              <Th>Avaliação</Th>
              <Th sortable active={sort === "aiScore"} onClick={() => toggleSort("aiScore")}>
                Score IA
              </Th>
              <Th>Status</Th>
              <Th sortable active={sort === "foundAt"} onClick={() => toggleSort("foundAt")} className="pr-5">
                Detectada
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => {
              const s = storeById[d.store];
              const c = categoryById[d.category];
              return (
                <motion.tr
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.24, delay: Math.min(i * 0.015, 0.3) }}
                  className="group border-b border-line/70 transition-colors duration-150 hover:bg-white/[0.028]"
                >
                  <td className="py-2.5 pl-5 pr-4">
                    <div className="flex items-center gap-3">
                      <DealThumb deal={d} size={40} />
                      <div className="min-w-0 max-w-[300px]">
                        <p className="truncate text-[13px] font-medium text-fg">{d.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
                          <span>{d.brand}</span>
                          {d.freeShipping && (
                            <Truck className="h-3 w-3 text-blue" strokeWidth={2} />
                          )}
                          {d.coupon && (
                            <span className="flex items-center gap-0.5 text-warn">
                              <Ticket className="h-3 w-3" strokeWidth={2} />
                              {d.coupon}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 text-[12.5px] text-fg-muted">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: s.accent }}
                      />
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 text-[12.5px] text-fg-muted">
                    {c.emoji} {c.name}
                  </td>
                  <td className="num px-4 text-[13px] font-semibold text-fg">
                    {money(d.price)}
                  </td>
                  <td className="num px-4 text-[12.5px] text-fg-subtle line-through">
                    {money(d.previousPrice)}
                  </td>
                  <td className="px-4">
                    <Badge tone={d.discount >= 45 ? "danger" : "neutral"}>−{d.discount}%</Badge>
                  </td>
                  <td className="num px-4 text-[12.5px] text-fg-muted">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warn text-warn" />
                      {d.rating.toFixed(1).replace(".", ",")}
                      <span className="text-fg-subtle">({int(d.reviews)})</span>
                    </span>
                  </td>
                  <td className="px-4">
                    <ScoreBar score={d.aiScore} />
                  </td>
                  <td className="px-4">
                    <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>
                  </td>
                  <td className="num px-4 pr-5 text-[12px] text-fg-subtle" title={dateTimeOf(d.foundAt)}>
                    {relativeTime(d.foundAt, NOW)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] font-medium text-fg">Nenhuma oferta encontrada</p>
          <p className="mt-1 text-[12px] text-fg-subtle">
            Ajuste os filtros ou aguarde o próximo ciclo de varredura.
          </p>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
  sortable,
  active,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle",
        sortable && "cursor-pointer select-none hover:text-fg-muted",
        active && "text-fg-muted",
        className,
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && <ArrowUpDown className="h-3 w-3 opacity-60" strokeWidth={2} />}
      </span>
    </th>
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 85 ? "#34d399" : score >= 70 ? "var(--color-primary)" : score >= 50 ? "#fbbf24" : "#fb7185";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${score}%`, background: tone }}
        />
      </span>
      <span className="num text-[12px] font-medium" style={{ color: tone }}>
        {score}
      </span>
    </span>
  );
}
