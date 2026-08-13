/**
 * Seed do BeautyBot — apenas configuração de base, nunca dados fictícios de
 * operação. Produtos, ofertas, cliques e receita só entram no banco quando um
 * conector real os produzir; semear métricas inventadas contaminaria o
 * histórico e as estatísticas de preço logo no primeiro dia.
 *
 * Idempotente: todas as escritas são upsert por chave natural, então rodar
 * várias vezes converge para o mesmo estado.
 *
 *   npx tsx prisma/seed.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  AffiliateNetwork,
  IntegrationType,
  JobType,
  ParseMode,
  PrismaClient,
  SettingScope,
  SettingValueType,
  StoreStatus,
} from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não definida");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------------------

const CATEGORIES = [
  { slug: "skincare", name: "Skincare", emoji: "🧴", accentColor: "#8b5cf6", minDiscountPercent: 35, sortOrder: 1 },
  { slug: "maquiagem", name: "Maquiagem", emoji: "💄", accentColor: "#ec4899", minDiscountPercent: 40, sortOrder: 2 },
  { slug: "cabelos", name: "Cabelos", emoji: "💇", accentColor: "#3b82f6", minDiscountPercent: 35, sortOrder: 3 },
  { slug: "perfumaria", name: "Perfumaria", emoji: "🌸", accentColor: "#a78bfa", minDiscountPercent: 30, sortOrder: 4 },
  { slug: "unhas", name: "Unhas", emoji: "💅", accentColor: "#f472b6", minDiscountPercent: 45, sortOrder: 5 },
  { slug: "corpo-banho", name: "Corpo & Banho", emoji: "🛁", accentColor: "#22d3ee", minDiscountPercent: 40, sortOrder: 6 },
  { slug: "dispositivos", name: "Dispositivos", emoji: "⚡", accentColor: "#fbbf24", minDiscountPercent: 25, sortOrder: 7, isActive: false },
];

const STORES = [
  { slug: "shopee", name: "Shopee Brasil", connectorKey: "shopee-affiliate-v2", integrationType: IntegrationType.AFFILIATE_API, accentColor: "#f97316", commission: "0.0800", network: AffiliateNetwork.SHOPEE_AFFILIATE, quota: 10000, rateLimit: 120 },
  { slug: "amazon", name: "Amazon BR", connectorKey: "amazon-paapi-5", integrationType: IntegrationType.OFFICIAL_API, accentColor: "#fbbf24", commission: "0.0500", network: AffiliateNetwork.AMAZON_ASSOCIATES, quota: 8640, rateLimit: 60 },
  { slug: "mercado-livre", name: "Mercado Livre", connectorKey: "meli-items-v1", integrationType: IntegrationType.OFFICIAL_API, accentColor: "#facc15", commission: "0.0600", network: AffiliateNetwork.MERCADO_LIVRE, quota: 9000, rateLimit: 90 },
  { slug: "beleza-na-web", name: "Beleza na Web", connectorKey: "bnw-scraper-v3", integrationType: IntegrationType.SCRAPER, accentColor: "#ec4899", commission: "0.1000", network: AffiliateNetwork.LOMADEE, quota: 5000, rateLimit: 30 },
  { slug: "epoca-cosmeticos", name: "Época Cosméticos", connectorKey: "epoca-scraper-v1", integrationType: IntegrationType.SCRAPER, accentColor: "#a78bfa", commission: "0.0900", network: AffiliateNetwork.AWIN, quota: 4000, rateLimit: 30, status: StoreStatus.PAUSED },
];

const SETTINGS = [
  { key: "search.interval_minutes", valueType: SettingValueType.NUMBER, value: 15, description: "Intervalo entre ciclos de varredura" },
  { key: "offer.min_discount_percent", valueType: SettingValueType.PERCENT, value: 35, description: "Desconto mínimo global para uma oferta ser elegível" },
  { key: "offer.dedupe_window_hours", valueType: SettingValueType.DURATION, value: 72, description: "Janela em que o mesmo produto não se repete" },
  { key: "offer.price_history_days", valueType: SettingValueType.NUMBER, value: 90, description: "Janela de histórico usada na validação de desconto real" },
  { key: "ai.auto_publish_score", valueType: SettingValueType.NUMBER, value: 85, description: "Score a partir do qual publica sem intervenção" },
  { key: "ai.min_keep_score", valueType: SettingValueType.NUMBER, value: 50, description: "Abaixo disso a oferta é descartada" },
  { key: "ai.require_manual_review", valueType: SettingValueType.BOOLEAN, value: true, description: "Ofertas entre os dois limiares vão para a fila" },
  { key: "publish.window_start", valueType: SettingValueType.STRING, value: "08:00", description: "Início da janela de publicação" },
  { key: "publish.window_end", valueType: SettingValueType.STRING, value: "22:00", description: "Fim da janela de publicação" },
  { key: "publish.max_per_hour", valueType: SettingValueType.NUMBER, value: 6, description: "Teto de publicações por hora por canal" },
  { key: "seller.min_reputation", valueType: SettingValueType.NUMBER, value: 4.3, description: "Reputação mínima do vendedor" },
  { key: "retention.debug_logs_days", valueType: SettingValueType.NUMBER, value: 14, description: "Retenção de logs de nível DEBUG" },
  { key: "retention.logs_days", valueType: SettingValueType.NUMBER, value: 90, description: "Retenção dos demais níveis de log" },
];

const JOBS = [
  { key: "store-sync", name: "Varredura das lojas", jobType: JobType.STORE_SYNC, cronExpression: "*/15 * * * *", timeoutSeconds: 600, description: "Dispara um conector por loja ativa" },
  { key: "ai-evaluation", name: "Avaliação da IA", jobType: JobType.AI_EVALUATION, cronExpression: "*/5 * * * *", timeoutSeconds: 300, description: "Pontua ofertas em estado VALIDATED" },
  { key: "publish-queue", name: "Fila de publicação", jobType: JobType.PUBLISH_QUEUE, cronExpression: "* * * * *", timeoutSeconds: 120, description: "Entrega mensagens agendadas cuja hora chegou" },
  { key: "price-stats", name: "Estatísticas de preço", jobType: JobType.PRICE_STATS, cronExpression: "0 3 * * *", timeoutSeconds: 1800, description: "Recalcula PriceStatistic por janela" },
  { key: "analytics-rollup", name: "Consolidação de analytics", jobType: JobType.ANALYTICS_ROLLUP, cronExpression: "30 3 * * *", timeoutSeconds: 900, description: "Reprocessa DailyAnalytics dos últimos 7 dias" },
  { key: "coupon-verify", name: "Verificação de cupons", jobType: JobType.COUPON_VERIFY, cronExpression: "0 */6 * * *", timeoutSeconds: 600, description: "Revalida cupons ativos — publicar cupom morto é o erro mais visível" },
  { key: "retention-cleanup", name: "Retenção de dados", jobType: JobType.RETENTION_CLEANUP, cronExpression: "0 4 * * *", timeoutSeconds: 1800, description: "Aplica as políticas de retenção" },
  { key: "health-check", name: "Saúde dos conectores", jobType: JobType.HEALTH_CHECK, cronExpression: "*/10 * * * *", timeoutSeconds: 120, description: "Atualiza healthStatus de cada loja" },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log("→ operador");
  const owner = await db.user.upsert({
    where: { email: "operador@beautybot.local" },
    update: {},
    create: {
      email: "operador@beautybot.local",
      name: "Operador",
      role: "OWNER",
    },
  });

  console.log("→ categorias");
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, emoji: c.emoji, accentColor: c.accentColor },
      create: {
        slug: c.slug,
        name: c.name,
        emoji: c.emoji,
        accentColor: c.accentColor,
        minDiscountPercent: c.minDiscountPercent,
        sortOrder: c.sortOrder,
        isActive: c.isActive ?? true,
        path: `/${c.slug}`,
        depth: 0,
      },
    });
  }

  console.log("→ lojas e programas de afiliado");
  for (const s of STORES) {
    const store = await db.store.upsert({
      where: { slug: s.slug },
      update: { name: s.name, connectorKey: s.connectorKey },
      create: {
        slug: s.slug,
        name: s.name,
        connectorKey: s.connectorKey,
        integrationType: s.integrationType,
        accentColor: s.accentColor,
        defaultCommissionRate: s.commission,
        quotaDailyLimit: s.quota,
        rateLimitPerMinute: s.rateLimit,
        status: s.status ?? StoreStatus.ACTIVE,
        isActive: (s.status ?? StoreStatus.ACTIVE) === StoreStatus.ACTIVE,
      },
    });

    await db.affiliateProgram.upsert({
      where: { storeId_network: { storeId: store.id, network: s.network } },
      update: {},
      create: {
        storeId: store.id,
        name: `${s.name} — programa de afiliados`,
        network: s.network,
        commissionRate: s.commission,
      },
    });
  }

  console.log("→ template de mensagem");
  const template = await db.messageTemplate.upsert({
    where: { slug_version: { slug: "oferta-padrao", version: 1 } },
    update: {},
    create: {
      slug: "oferta-padrao",
      version: 1,
      name: "Oferta padrão",
      parseMode: ParseMode.MARKDOWN_V2,
      isDefault: true,
      body: [
        "🔥 *{{discount}}% OFF* — {{title}}",
        "",
        "💰 De ~R$ {{previousPrice}}~ por *R$ {{price}}*",
        "{{#coupon}}🎟 Cupom: `{{coupon}}`{{/coupon}}",
        "{{#freeShipping}}🚚 Frete grátis{{/freeShipping}}",
        "⭐ {{rating}} ({{reviewCount}} avaliações)",
        "",
        "👉 {{link}}",
      ].join("\n"),
      variables: {
        title: "string",
        price: "string",
        previousPrice: "string",
        discount: "number",
        coupon: "string?",
        freeShipping: "boolean",
        rating: "string",
        reviewCount: "number",
        link: "string",
      },
    },
  });

  console.log("→ canais do Telegram");
  const channels = [
    { chatId: -1001000000001n, handle: "@beautybot_ofertas", title: "BeautyBot · Ofertas", cats: ["cabelos", "perfumaria", "dispositivos"], isPrimary: true },
    { chatId: -1001000000002n, handle: "@beautybot_skincare", title: "BeautyBot · Skincare", cats: ["skincare", "corpo-banho"], isPrimary: false },
    { chatId: -1001000000003n, handle: "@beautybot_makeup", title: "BeautyBot · Make", cats: ["maquiagem", "unhas"], isPrimary: false },
  ];

  for (const ch of channels) {
    const channel = await db.telegramChannel.upsert({
      where: { handle: ch.handle },
      update: { title: ch.title },
      create: {
        chatId: ch.chatId,
        handle: ch.handle,
        title: ch.title,
        isPrimary: ch.isPrimary,
        defaultTemplateId: template.id,
      },
    });

    for (const slug of ch.cats) {
      const category = await db.category.findUnique({ where: { slug } });
      if (!category) continue;
      await db.channelCategory.upsert({
        where: {
          channelId_categoryId: { channelId: channel.id, categoryId: category.id },
        },
        update: {},
        create: { channelId: channel.id, categoryId: category.id },
      });
    }
  }

  console.log("→ jobs do scheduler");
  for (const j of JOBS) {
    await db.schedulerJob.upsert({
      where: { key: j.key },
      update: { cronExpression: j.cronExpression, name: j.name },
      create: {
        key: j.key,
        name: j.name,
        description: j.description,
        jobType: j.jobType,
        cronExpression: j.cronExpression,
        timeoutSeconds: j.timeoutSeconds,
      },
    });
  }

  console.log("→ configurações");
  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: {
        key_scope_scopeId: {
          key: s.key,
          scope: SettingScope.GLOBAL,
          scopeId: "",
        },
      },
      update: {},
      create: {
        key: s.key,
        scope: SettingScope.GLOBAL,
        valueType: s.valueType,
        value: s.value,
        defaultValue: s.value,
        description: s.description,
        updatedByUserId: owner.id,
      },
    });
  }

  console.log("→ modelo de IA");
  await db.aiModel.upsert({
    where: { key: "beautybot-scorer-v1" },
    update: {},
    create: {
      key: "beautybot-scorer-v1",
      provider: "anthropic",
      modelId: "claude-sonnet-5",
      purpose: "OFFER_SCORING",
      isActive: true,
      costPer1kInput: "0.003000",
      costPer1kOutput: "0.015000",
    },
  });

  console.log("\n✔ seed concluído");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
