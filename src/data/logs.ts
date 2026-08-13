import type { ActivityEvent, LogEntry, TelegramChannel } from "@/types";
import { minutesAgo } from "./stores";

export const activity: ActivityEvent[] = [
  { id: "a01", ts: minutesAgo(1), kind: "telegram", title: "Publicação enviada", detail: "@beautybot_skincare · Sérum Vitamina C — 47% OFF" },
  { id: "a02", ts: minutesAgo(2), kind: "ia", title: "IA aprovou 6 ofertas", detail: "score médio 90,1 · 1,4 s por decisão" },
  { id: "a03", ts: minutesAgo(3), kind: "busca", title: "Shopee finalizou busca", detail: "1.284 produtos lidos · latência média 812 ms" },
  { id: "a04", ts: minutesAgo(5), kind: "sistema", title: "Cache de preços atualizado", detail: "18.402 chaves · TTL 6 h" },
  { id: "a05", ts: minutesAgo(6), kind: "busca", title: "Amazon iniciou sincronização", detail: "42 termos monitorados · lote 1 de 3" },
  { id: "a06", ts: minutesAgo(8), kind: "ia", title: "12 ofertas descartadas", detail: "desconto falso detectado no histórico de 90 dias" },
  { id: "a07", ts: minutesAgo(11), kind: "telegram", title: "Publicação enviada", detail: "@beautybot_makeup · Paleta Nude — 50% OFF" },
  { id: "a08", ts: minutesAgo(14), kind: "erro", title: "Mercado Livre respondeu 429", detail: "backoff exponencial · nova tentativa em 60 s" },
  { id: "a09", ts: minutesAgo(17), kind: "busca", title: "Beleza na Web finalizou busca", detail: "318 produtos lidos · 4 novas ofertas" },
  { id: "a10", ts: minutesAgo(21), kind: "sistema", title: "Scheduler disparou ciclo #4.812", detail: "5 conectores enfileirados" },
  { id: "a11", ts: minutesAgo(24), kind: "ia", title: "Modelo reavaliou preço-âncora", detail: "3 ofertas reclassificadas como falsas" },
  { id: "a12", ts: minutesAgo(28), kind: "telegram", title: "Publicação agendada", detail: "@beautybot_ofertas · janela das 19h" },
];

export const logs: LogEntry[] = [
  { id: "L-9412", ts: minutesAgo(1), level: "sucesso", source: "telegram.publisher", message: "Mensagem entregue ao canal @beautybot_skincare", meta: { deal: "DL-2486", message_id: 88214 }, durationMs: 412 },
  { id: "L-9411", ts: minutesAgo(2), level: "info", source: "ai.evaluator", message: "Lote avaliado: 18 ofertas · 6 aprovadas · 12 rejeitadas", meta: { modelo: "beautybot-scorer-v4", tokens: 14820 }, durationMs: 1412 },
  { id: "L-9410", ts: minutesAgo(3), level: "sucesso", source: "connector.shopee", message: "Busca concluída para 34 termos monitorados", meta: { produtos: 1284, novos: 96 }, durationMs: 8120 },
  { id: "L-9409", ts: minutesAgo(3), level: "debug", source: "pricing.validator", message: "Histórico de preços carregado do cache", meta: { hit_rate: "94,2%", chaves: 1284 }, durationMs: 62 },
  { id: "L-9408", ts: minutesAgo(5), level: "info", source: "cache.redis", message: "Snapshot de preços regravado", meta: { chaves: 18402, ttl: "6h" }, durationMs: 240 },
  { id: "L-9407", ts: minutesAgo(6), level: "info", source: "connector.amazon", message: "Sincronização iniciada (lote 1/3)", meta: { termos: 42 } },
  { id: "L-9406", ts: minutesAgo(8), level: "aviso", source: "ai.evaluator", message: "12 ofertas descartadas por preço-âncora inflado", meta: { limiar: "desvio > 40%" }, durationMs: 890 },
  { id: "L-9405", ts: minutesAgo(11), level: "sucesso", source: "telegram.publisher", message: "Mensagem entregue ao canal @beautybot_makeup", meta: { deal: "DL-2482", message_id: 88213 }, durationMs: 388 },
  { id: "L-9404", ts: minutesAgo(14), level: "erro", source: "connector.mercadolivre", message: "HTTP 429 Too Many Requests — rate limit do parceiro", meta: { tentativa: 2, backoff: "60s" }, durationMs: 2140 },
  { id: "L-9403", ts: minutesAgo(15), level: "aviso", source: "queue.worker", message: "Job reenfileirado após falha transitória", meta: { job: "sync:mercadolivre", fila: "connectors" } },
  { id: "L-9402", ts: minutesAgo(17), level: "sucesso", source: "connector.beleza-na-web", message: "Busca concluída · 4 novas ofertas elegíveis", meta: { produtos: 318 }, durationMs: 6420 },
  { id: "L-9401", ts: minutesAgo(19), level: "debug", source: "dedupe.service", message: "31 duplicatas suprimidas na janela de 72 h", meta: { estrategia: "hash(titulo+loja+preco)" }, durationMs: 44 },
  { id: "L-9400", ts: minutesAgo(21), level: "info", source: "scheduler", message: "Ciclo #4.812 disparado", meta: { conectores: 5, cron: "*/15 * * * *" } },
  { id: "L-9399", ts: minutesAgo(24), level: "info", source: "ai.evaluator", message: "Reavaliação de preço-âncora concluída", meta: { reclassificadas: 3 }, durationMs: 1180 },
  { id: "L-9398", ts: minutesAgo(28), level: "sucesso", source: "telegram.scheduler", message: "Publicação agendada para a janela das 19h", meta: { deal: "DL-2497" } },
  { id: "L-9397", ts: minutesAgo(33), level: "erro", source: "connector.epoca", message: "Conector pausado manualmente pelo operador", meta: { motivo: "seletor DOM alterado" } },
  { id: "L-9396", ts: minutesAgo(38), level: "aviso", source: "affiliate.linker", message: "Tag de afiliado ausente para 2 produtos", meta: { loja: "mercadolivre" } },
  { id: "L-9395", ts: minutesAgo(44), level: "sucesso", source: "connector.shopee", message: "Busca concluída para 34 termos monitorados", meta: { produtos: 1198, novos: 74 }, durationMs: 7840 },
  { id: "L-9394", ts: minutesAgo(51), level: "debug", source: "metrics.collector", message: "Métricas agregadas gravadas", meta: { janela: "5m", series: 42 }, durationMs: 96 },
  { id: "L-9393", ts: minutesAgo(58), level: "info", source: "system", message: "Aplicação saudável · uptime 9d 04h", meta: { rss_mb: 412, event_loop_lag_ms: 3 } },
];

export const channels: TelegramChannel[] = [
  { id: "c1", name: "BeautyBot · Ofertas", handle: "@beautybot_ofertas", members: 24810, categories: ["cabelos", "perfumaria", "dispositivos"], active: true, postsToday: 18, ctr: 6.4 },
  { id: "c2", name: "BeautyBot · Skincare", handle: "@beautybot_skincare", members: 12440, categories: ["skincare", "corpo-banho"], active: true, postsToday: 14, ctr: 8.2 },
  { id: "c3", name: "BeautyBot · Make", handle: "@beautybot_makeup", members: 18920, categories: ["maquiagem", "unhas"], active: true, postsToday: 21, ctr: 9.1 },
  { id: "c4", name: "BeautyBot · Testes", handle: "@beautybot_lab", members: 42, categories: [], active: false, postsToday: 0, ctr: 0 },
];
