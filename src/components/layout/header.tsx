"use client";

import { usePathname } from "next/navigation";
import { Bell, Command, Moon, RefreshCw, Search, Sun, Zap } from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";
import { useTheme } from "@/app/providers";

const titles: Record<string, string> = {
  "/": "Central de Operações",
  "/promocoes": "Promoções",
  "/enviadas": "Enviadas",
  "/agendadas": "Agendadas",
  "/lojas": "Lojas",
  "/categorias": "Categorias",
  "/ia": "Inteligência Artificial",
  "/analytics": "Analytics",
  "/logs": "Logs",
  "/configuracoes": "Configurações",
};

export function Header() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "BeautyBot";
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-[56px] items-center gap-4 border-b border-line bg-base px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-[13px] text-fg-subtle">BeautyBot</span>
        <span className="text-fg-subtle/50">/</span>
        <span className="truncate text-[13px] font-medium text-fg">
          {title}
        </span>
      </div>

      <button className="group ml-auto hidden h-8 w-[280px] items-center gap-2 rounded border border-line bg-surface-2 px-3 text-[12.5px] text-fg-subtle transition-colors hover:border-fg-subtle hover:text-fg-muted md:flex">
        <Search className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="flex-1 text-left">Buscar ofertas, lojas, logs…</span>
        <kbd className="flex items-center gap-0.5 rounded border border-line-strong bg-surface px-1.5 py-[1px] text-[10px] text-fg-subtle">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <Badge tone="ok" className="hidden sm:inline-flex">
          <StatusDot tone="ok" />
          Online
        </Badge>

        <Tooltip content={theme === "dark" ? "Modo claro" : "Modo escuro"}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Alternar tema"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" strokeWidth={1.9} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.9} />
            )}
          </Button>
        </Tooltip>

        <Tooltip content="Sincronizar todos os conectores">
          <Button size="icon" variant="ghost" aria-label="Sincronizar">
            <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        </Tooltip>

        <Tooltip content="3 alertas não lidos">
          <Button size="icon" variant="ghost" aria-label="Alertas" className="relative">
            <Bell className="h-4 w-4" strokeWidth={1.9} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
          </Button>
        </Tooltip>

        <Button variant="primary" size="sm" className="ml-1">
          <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
          Executar agora
        </Button>
      </div>
    </header>
  );
}
