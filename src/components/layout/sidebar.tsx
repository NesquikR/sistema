"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  Flame,
  LayoutGrid,
  ScrollText,
  Send,
  Settings,
  Sparkles,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/badge";

const nav = [
  { href: "/", label: "Central de Operações", icon: LayoutGrid, badge: null },
  { href: "/promocoes", label: "Promoções", icon: Flame, badge: "6" },
  { href: "/enviadas", label: "Enviadas", icon: Send, badge: null },
  { href: "/agendadas", label: "Agendadas", icon: CalendarClock, badge: "4" },
  { href: "/lojas", label: "Lojas", icon: Store, badge: null },
  { href: "/categorias", label: "Categorias", icon: Sparkles, badge: null },
  { href: "/ia", label: "IA", icon: Bot, badge: null },
  { href: "/analytics", label: "Analytics", icon: BarChart3, badge: null },
  { href: "/logs", label: "Logs", icon: ScrollText, badge: null },
  { href: "/configuracoes", label: "Configurações", icon: Settings, badge: null },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-surface lg:flex">
      {/* Marca */}
      <div className="flex h-[56px] items-center gap-2.5 border-b border-line px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
        </div>
        <div className="leading-none">
          <div className="text-[14px] font-semibold tracking-[-0.02em] text-fg">
            Beauty<span className="text-primary">Bot</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Intelligence
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          Operação
        </p>
        <ul className="space-y-0.5">
          {nav.map((item, i) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            if (i === 6) {
              return (
                <li key={item.href}>
                  <p className="px-2 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                    Inteligência
                  </p>
                  <NavLink item={item} active={active} Icon={Icon} />
                </li>
              );
            }
            return (
              <li key={item.href}>
                <NavLink item={item} active={active} Icon={Icon} />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Saúde do sistema */}
      <div className="border-t border-line p-3">
        <div className="rounded border border-line bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-fg">
              <StatusDot tone="ok" />
              Motor ativo
            </span>
            <Activity className="h-3.5 w-3.5 text-fg-subtle" />
          </div>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            <Row label="Uptime" value="9d 04h" />
            <Row label="Fila" value="18 jobs" />
            <Row label="Próximo ciclo" value="em 2 min" />
          </dl>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="num font-medium text-fg-muted">{value}</dd>
    </div>
  );
}

function NavLink({
  item,
  active,
  Icon,
}: {
  item: (typeof nav)[number];
  active: boolean;
  Icon: React.ElementType;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded px-2.5 text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-primary-bg text-primary"
          : "text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-sm bg-primary" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-fg-subtle group-hover:text-fg-muted",
        )}
        strokeWidth={1.9}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="num rounded border border-primary/20 bg-primary-bg px-1.5 py-[1px] text-[10px] font-semibold text-primary">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
