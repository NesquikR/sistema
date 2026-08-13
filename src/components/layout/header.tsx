"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Command, RefreshCw, Search, Zap } from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";

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

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b border-line bg-base/70 px-6 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-[13px] text-fg-subtle">BeautyBot</span>
        <span className="text-fg-subtle/50">/</span>
        <motion.span
          key={title}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="truncate text-[13px] font-medium text-fg"
        >
          {title}
        </motion.span>
      </div>

      <button className="group ml-auto hidden h-8 w-[280px] items-center gap-2 rounded-[10px] border border-line bg-black/25 px-3 text-[12.5px] text-fg-subtle transition-colors hover:border-white/15 hover:text-fg-muted md:flex">
        <Search className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="flex-1 text-left">Buscar ofertas, lojas, logs…</span>
        <kbd className="flex items-center gap-0.5 rounded border border-line-strong bg-white/[0.04] px-1.5 py-[1px] text-[10px] text-fg-subtle">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <Badge tone="ok" className="hidden sm:inline-flex">
          <StatusDot tone="ok" />
          Online
        </Badge>

        <Tooltip content="Sincronizar todos os conectores">
          <Button size="icon" variant="ghost" aria-label="Sincronizar">
            <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        </Tooltip>

        <Tooltip content="3 alertas não lidos">
          <Button size="icon" variant="ghost" aria-label="Alertas" className="relative">
            <Bell className="h-4 w-4" strokeWidth={1.9} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pink shadow-[0_0_8px_#ec4899]" />
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
