export type StoreId = "shopee" | "amazon" | "mercadolivre" | "beleza-na-web" | "epoca";

export type StoreStatus = "online" | "degradado" | "offline" | "pausado";

export interface Store {
  id: StoreId;
  name: string;
  short: string;
  accent: string;
  status: StoreStatus;
  lastSync: string;
  nextSync: string;
  productsFound: number;
  dealsApproved: number;
  errors24h: number;
  avgLatencyMs: number;
  successRate: number;
  quotaUsed: number;
  quotaLimit: number;
  connector: string;
  throughput: number[];
}

export type CategoryId =
  | "skincare"
  | "maquiagem"
  | "cabelos"
  | "perfumaria"
  | "unhas"
  | "corpo-banho"
  | "dispositivos";

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  accent: string;
  active: boolean;
  minDiscount: number;
  deals30d: number;
  revenue30d: number;
  ctr: number;
  conversion: number;
  share: number;
  trend: number;
}

export type DealStatus =
  | "fila"
  | "aprovada"
  | "agendada"
  | "publicada"
  | "ignorada"
  | "expirada";

export interface Deal {
  id: string;
  title: string;
  brand: string;
  image: string;
  store: StoreId;
  category: CategoryId;
  price: number;
  previousPrice: number;
  averagePrice: number;
  discount: number;
  coupon: string | null;
  freeShipping: boolean;
  rating: number;
  reviews: number;
  sold30d: number;
  aiScore: number;
  aiVerdict: string;
  priceHistory: number[];
  status: DealStatus;
  foundAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  channel?: string;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  message?: string;
}

export type LogLevel = "info" | "sucesso" | "aviso" | "erro" | "debug";

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  meta?: Record<string, string | number>;
  durationMs?: number;
}

export interface ActivityEvent {
  id: string;
  ts: string;
  kind: "busca" | "ia" | "telegram" | "sistema" | "erro";
  title: string;
  detail: string;
}

export interface TelegramChannel {
  id: string;
  name: string;
  handle: string;
  members: number;
  categories: CategoryId[];
  active: boolean;
  postsToday: number;
  ctr: number;
}
