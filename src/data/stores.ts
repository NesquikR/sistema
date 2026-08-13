import type { Store } from "@/types";

/** Âncora temporal fixa: evita divergência de hidratação entre server e client. */
export const NOW = new Date("2026-08-05T11:06:00-03:00");

export const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();
export const minutesAhead = (m: number) =>
  new Date(NOW.getTime() + m * 60_000).toISOString();
export const hoursAgo = (h: number) => minutesAgo(h * 60);

export const stores: Store[] = [
  {
    id: "shopee",
    name: "Shopee Brasil",
    short: "SP",
    accent: "#f97316",
    status: "online",
    lastSync: minutesAgo(4),
    nextSync: minutesAhead(11),
    productsFound: 18420,
    dealsApproved: 312,
    errors24h: 2,
    avgLatencyMs: 812,
    successRate: 99.1,
    quotaUsed: 6420,
    quotaLimit: 10000,
    connector: "shopee-affiliate-v2",
    throughput: [220, 260, 310, 280, 340, 420, 380, 460, 520, 480, 610, 540],
  },
  {
    id: "amazon",
    name: "Amazon BR",
    short: "AZ",
    accent: "#fbbf24",
    status: "online",
    lastSync: minutesAgo(9),
    nextSync: minutesAhead(6),
    productsFound: 12980,
    dealsApproved: 244,
    errors24h: 0,
    avgLatencyMs: 640,
    successRate: 99.8,
    quotaUsed: 3120,
    quotaLimit: 8640,
    connector: "amazon-paapi-5",
    throughput: [180, 210, 190, 240, 300, 280, 330, 360, 340, 410, 390, 430],
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    short: "ML",
    accent: "#facc15",
    status: "degradado",
    lastSync: minutesAgo(23),
    nextSync: minutesAhead(2),
    productsFound: 9640,
    dealsApproved: 156,
    errors24h: 14,
    avgLatencyMs: 2140,
    successRate: 91.4,
    quotaUsed: 7810,
    quotaLimit: 9000,
    connector: "meli-items-v1",
    throughput: [140, 160, 150, 120, 90, 130, 110, 160, 90, 70, 120, 100],
  },
  {
    id: "beleza-na-web",
    name: "Beleza na Web",
    short: "BW",
    accent: "#ec4899",
    status: "online",
    lastSync: minutesAgo(17),
    nextSync: minutesAhead(28),
    productsFound: 5310,
    dealsApproved: 98,
    errors24h: 1,
    avgLatencyMs: 1180,
    successRate: 98.2,
    quotaUsed: 1240,
    quotaLimit: 5000,
    connector: "bnw-scraper-v3",
    throughput: [80, 95, 110, 100, 130, 120, 145, 160, 150, 170, 190, 180],
  },
  {
    id: "epoca",
    name: "Época Cosméticos",
    short: "EP",
    accent: "#a78bfa",
    status: "pausado",
    lastSync: hoursAgo(9),
    nextSync: minutesAhead(0),
    productsFound: 3105,
    dealsApproved: 41,
    errors24h: 0,
    avgLatencyMs: 1460,
    successRate: 96.9,
    quotaUsed: 0,
    quotaLimit: 4000,
    connector: "epoca-scraper-v1",
    throughput: [60, 70, 55, 40, 30, 20, 10, 0, 0, 0, 0, 0],
  },
];

export const storeById = Object.fromEntries(stores.map((s) => [s.id, s])) as Record<
  Store["id"],
  Store
>;
