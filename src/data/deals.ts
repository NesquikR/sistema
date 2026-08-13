import type { CategoryId, Deal, DealStatus, StoreId } from "@/types";
import { minutesAgo, minutesAhead } from "./stores";

/** PRNG determinístico — mesma saída no servidor e no cliente. */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function buildHistory(seed: number, current: number, average: number) {
  const rnd = seeded(seed);
  const points: number[] = [];
  for (let i = 0; i < 22; i++) {
    const drift = (rnd() - 0.45) * average * 0.08;
    points.push(Number((average + drift).toFixed(2)));
  }
  points.push(Number((average * 0.98).toFixed(2)));
  points.push(current);
  return points;
}

const gradients = [
  "linear-gradient(135deg, #8b5cf633, #ec489922)",
  "linear-gradient(135deg, #3b82f633, #22d3ee22)",
  "linear-gradient(135deg, #ec489933, #fbbf2422)",
  "linear-gradient(135deg, #a78bfa33, #3b82f622)",
  "linear-gradient(135deg, #22d3ee33, #8b5cf622)",
  "linear-gradient(135deg, #fb718533, #a78bfa22)",
];

type Row = [
  title: string,
  brand: string,
  category: CategoryId,
  store: StoreId,
  price: number,
  previousPrice: number,
  averagePrice: number,
  coupon: string | null,
  freeShipping: boolean,
  rating: number,
  reviews: number,
  sold30d: number,
  aiScore: number,
  verdict: string,
  status: DealStatus,
  minutes: number,
];

const rows: Row[] = [
  // ── Fila da IA (aguardando decisão) ──────────────────────────────
  ["Sérum Facial Vitamina C 30ml", "Principia", "skincare", "shopee", 68.9, 129.9, 121.4, "BEAUTY20", true, 4.8, 3241, 890, 94, "Menor preço em 90 dias · histórico estável · alta conversão na categoria", "fila", 3],
  ["Protetor Solar Facial FPS 70 Toque Seco", "La Roche-Posay", "skincare", "amazon", 74.5, 139.9, 128.7, null, true, 4.9, 12480, 2140, 91, "Queda real de 42% · marca com CTR acima da média", "fila", 6],
  ["Paleta de Sombras 18 Cores Nude", "Ruby Rose", "maquiagem", "shopee", 29.9, 59.9, 54.2, "RR15", true, 4.6, 8930, 4120, 88, "Ticket baixo mas volume alto · boa para horário de pico", "fila", 8],
  ["Máscara Capilar Reconstrução 500g", "Wella", "cabelos", "mercadolivre", 89.9, 169.9, 152.3, null, false, 4.7, 2210, 640, 79, "Desconto legítimo, porém frete reduz atratividade", "fila", 12],
  ["Base Líquida Alta Cobertura 30ml", "Maybelline", "maquiagem", "amazon", 39.9, 74.9, 68.5, "AMZ10", true, 4.5, 15620, 3310, 86, "Preço competitivo · estoque limitado detectado", "fila", 15],
  ["Kit Esmaltes Efeito Gel 6un", "Vult", "unhas", "shopee", 34.9, 79.9, 66.8, "VULT5", true, 4.4, 4180, 2870, 92, "Categoria com melhor conversão do mês (5,4%)", "fila", 19],

  // ── Publicadas ───────────────────────────────────────────────────
  ["Água Micelar 5 em 1 400ml", "Garnier", "skincare", "amazon", 24.9, 44.9, 41.2, null, true, 4.8, 28410, 9120, 90, "Item recorrente de alta rotatividade", "publicada", 42],
  ["Perfume Feminino Eau de Parfum 100ml", "Natura", "perfumaria", "beleza-na-web", 189.9, 329.9, 298.4, "BNW30", true, 4.9, 1840, 410, 87, "Ticket alto · margem de afiliado superior", "publicada", 68],
  ["Shampoo Antiqueda 300ml", "Kérastase", "cabelos", "beleza-na-web", 128.9, 219.9, 204.1, null, true, 4.7, 960, 220, 81, "Marca premium com baixa frequência de promoção", "publicada", 94],
  ["Batom Matte Longa Duração", "MAC", "maquiagem", "amazon", 98.9, 159.0, 148.6, null, true, 4.9, 5410, 780, 84, "Desconto moderado, porém marca de alta demanda", "publicada", 121],
  ["Creme Hidratante Corporal 400ml", "Nivea", "corpo-banho", "shopee", 19.9, 36.9, 33.4, "NIV10", true, 4.7, 19240, 7840, 83, "Volume alto em horário noturno", "publicada", 155],
  ["Ácido Hialurônico Sérum 30ml", "Creamy", "skincare", "shopee", 54.9, 99.9, 92.7, "CR15", true, 4.8, 6720, 1980, 93, "Melhor score da semana · zero devoluções", "publicada", 188],
  ["Secador de Cabelo Profissional 2200W", "Taiff", "cabelos", "mercadolivre", 289.9, 499.9, 462.3, null, true, 4.6, 3120, 340, 85, "Ticket alto · janela de promoção curta", "publicada", 232],
  ["Kit Skincare Rotina Completa 4 itens", "Sallve", "skincare", "beleza-na-web", 149.9, 259.9, 241.8, "SALLVE20", true, 4.9, 2140, 520, 89, "Combo com margem superior a itens avulsos", "publicada", 288],
  ["Delineador Caneta À Prova d'Água", "Océane", "maquiagem", "shopee", 17.9, 39.9, 35.1, null, true, 4.5, 11280, 5640, 80, "Isca de tráfego · CTR de 11,2%", "publicada", 331],
  ["Óleo Capilar Reparador 60ml", "Moroccanoil", "cabelos", "amazon", 149.0, 249.0, 236.5, null, true, 4.9, 1420, 190, 82, "Marca importada · baixa concorrência de afiliados", "publicada", 402],

  // ── Agendadas ────────────────────────────────────────────────────
  ["Esponja de Maquiagem Kit 4un", "Real Techniques", "maquiagem", "amazon", 44.9, 89.9, 81.2, "RT10", true, 4.8, 7310, 1420, 86, "Agendada para o pico das 19h", "agendada", -74],
  ["Sabonete Facial Ácido Salicílico", "CeraVe", "skincare", "amazon", 42.9, 79.9, 73.6, null, true, 4.9, 9840, 2610, 90, "Agendada para o pico das 20h", "agendada", -134],
  ["Perfume Masculino 100ml Amadeirado", "Boticário", "perfumaria", "beleza-na-web", 159.9, 279.9, 258.2, "BOT25", true, 4.7, 3240, 610, 85, "Agendada para janela de fim de semana", "agendada", -194],
  ["Alicate de Unha Inox Profissional", "Mundial", "unhas", "mercadolivre", 27.9, 54.9, 49.3, null, false, 4.6, 5120, 1840, 76, "Agendada — aguardando validação de frete", "agendada", -314],

  // ── Ignoradas / expiradas ────────────────────────────────────────
  ["Kit Maquiagem Completo 32 peças", "Genérico", "maquiagem", "shopee", 89.9, 399.9, 104.2, null, true, 3.4, 210, 90, 21, "Preço anterior inflado · desconto falso detectado", "ignorada", 51],
  ["Creme Facial Antirrugas 50g", "Sem marca", "skincare", "shopee", 39.9, 199.9, 44.8, null, true, 3.1, 84, 40, 14, "Histórico inconsistente · vendedor sem reputação", "ignorada", 77],
  ["Chapinha Titanium 480°C", "Importado", "cabelos", "mercadolivre", 119.9, 299.9, 132.6, null, false, 3.8, 340, 120, 33, "Reputação do vendedor abaixo do mínimo (4,2)", "ignorada", 109],
  ["Perfume Inspirado Importado 50ml", "Contratipo", "perfumaria", "shopee", 49.9, 189.9, 58.4, null, true, 3.9, 620, 310, 28, "Categoria bloqueada por política de conteúdo", "ignorada", 168],
  ["Máscara de Cílios Volume 4D", "Ruby Rose", "maquiagem", "shopee", 21.9, 34.9, 24.1, null, true, 4.4, 3210, 1120, 47, "Desconto de 9% abaixo do mínimo configurado", "ignorada", 214],
  ["Condicionador Nutritivo 250ml", "Pantene", "cabelos", "amazon", 18.9, 26.9, 20.4, null, false, 4.6, 8210, 3120, 52, "Margem insuficiente para o ticket", "expirada", 268],
];

export const deals: Deal[] = rows.map((r, i) => {
  const [
    title, brand, category, store, price, previousPrice, averagePrice,
    coupon, freeShipping, rating, reviews, sold30d, aiScore, verdict, status, minutes,
  ] = r;

  const rnd = seeded(i * 977 + 13);
  const published = status === "publicada";
  const clicks = published ? Math.round(180 + rnd() * 1400) : undefined;
  const conversions = clicks ? Math.round(clicks * (0.018 + rnd() * 0.045)) : undefined;

  return {
    id: `DL-${String(2480 + i).padStart(4, "0")}`,
    title,
    brand,
    image: gradients[i % gradients.length],
    store,
    category,
    price,
    previousPrice,
    averagePrice,
    discount: Math.round(((previousPrice - price) / previousPrice) * 100),
    coupon,
    freeShipping,
    rating,
    reviews,
    sold30d,
    aiScore,
    aiVerdict: verdict,
    priceHistory: buildHistory(i * 131 + 7, price, averagePrice),
    status,
    foundAt: minutes >= 0 ? minutesAgo(minutes + 2) : minutesAgo(30),
    scheduledFor: status === "agendada" ? minutesAhead(-minutes) : undefined,
    publishedAt: published ? minutesAgo(minutes) : undefined,
    channel: published || status === "agendada" ? channelFor(category) : undefined,
    clicks,
    conversions,
    revenue: conversions ? Number((conversions * price * 0.08).toFixed(2)) : undefined,
    message: published ? buildMessage(title, price, previousPrice, coupon) : undefined,
  };
});

function channelFor(category: CategoryId) {
  if (category === "skincare" || category === "corpo-banho") return "@beautybot_skincare";
  if (category === "maquiagem" || category === "unhas") return "@beautybot_makeup";
  return "@beautybot_ofertas";
}

function buildMessage(title: string, price: number, previous: number, coupon: string | null) {
  const off = Math.round(((previous - price) / previous) * 100);
  return [
    `🔥 ${off}% OFF — ${title}`,
    ``,
    `💰 De R$ ${previous.toFixed(2).replace(".", ",")} por R$ ${price.toFixed(2).replace(".", ",")}`,
    coupon ? `🎟 Cupom: ${coupon}` : `🚚 Frete grátis`,
    ``,
    `👉 Link na descrição`,
  ].join("\n");
}

export const dealsByStatus = (status: DealStatus) => deals.filter((d) => d.status === status);
export const aiQueue = dealsByStatus("fila");
