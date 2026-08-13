export interface HourPoint {
  hour: string;
  encontradas: number;
  aprovadas: number;
  publicadas: number;
  cliques: number;
  receita: number;
}

/** 24h de operação — curva realista com picos às 12h e 20h. */
export const hourly: HourPoint[] = [
  ["00h", 142, 18, 12, 210, 128.4],
  ["01h", 96, 11, 7, 118, 74.1],
  ["02h", 61, 6, 4, 62, 38.9],
  ["03h", 48, 4, 3, 41, 24.6],
  ["04h", 52, 5, 3, 38, 21.2],
  ["05h", 74, 8, 5, 66, 40.8],
  ["06h", 138, 16, 11, 148, 96.5],
  ["07h", 224, 27, 19, 262, 178.3],
  ["08h", 318, 39, 28, 401, 288.7],
  ["09h", 402, 51, 36, 528, 392.1],
  ["10h", 468, 60, 42, 611, 458.9],
  ["11h", 512, 66, 47, 684, 512.4],
  ["12h", 596, 78, 55, 812, 640.2],
  ["13h", 541, 69, 49, 726, 561.8],
  ["14h", 478, 61, 43, 638, 486.3],
  ["15h", 452, 57, 40, 592, 448.7],
  ["16h", 489, 62, 44, 651, 498.2],
  ["17h", 534, 68, 48, 719, 552.6],
  ["18h", 588, 76, 54, 806, 631.4],
  ["19h", 642, 84, 60, 918, 742.9],
  ["20h", 701, 92, 66, 1024, 848.3],
  ["21h", 634, 82, 58, 894, 718.6],
  ["22h", 462, 58, 41, 604, 462.1],
  ["23h", 286, 35, 24, 348, 251.7],
].map(([hour, encontradas, aprovadas, publicadas, cliques, receita]) => ({
  hour: hour as string,
  encontradas: encontradas as number,
  aprovadas: aprovadas as number,
  publicadas: publicadas as number,
  cliques: cliques as number,
  receita: receita as number,
}));

export interface DayPoint {
  day: string;
  receita: number;
  cliques: number;
  conversao: number;
  publicadas: number;
}

export const last30Days: DayPoint[] = Array.from({ length: 30 }, (_, i) => {
  const base = 780 + i * 41;
  const wave = Math.sin(i / 3.1) * 210 + Math.cos(i / 6.7) * 140;
  const weekend = i % 7 === 5 || i % 7 === 6 ? 1.22 : 1;
  const receita = Number(((base + wave) * weekend).toFixed(2));
  return {
    day: `${String(((i + 6) % 31) + 1).padStart(2, "0")}/07`,
    receita,
    cliques: Math.round(receita * 1.42),
    conversao: Number((2.6 + Math.sin(i / 4.3) * 0.9 + i * 0.021).toFixed(2)),
    publicadas: Math.round(28 + Math.sin(i / 2.6) * 9 + i * 0.42),
  };
});

export interface FunnelStage {
  stage: string;
  value: number;
  hint: string;
}

export const funnel: FunnelStage[] = [
  { stage: "Coletados", value: 49455, hint: "Produtos lidos pelos conectores" },
  { stage: "Elegíveis", value: 11840, hint: "Passaram nos filtros de categoria e preço" },
  { stage: "Desconto real", value: 3210, hint: "Sobreviveram à validação de histórico" },
  { stage: "Aprovados pela IA", value: 851, hint: "Score ≥ 70" },
  { stage: "Publicados", value: 604, hint: "Enviados ao Telegram" },
];

export const aiDecisions = [
  { label: "Aprovadas", value: 851, color: "#8b5cf6" },
  { label: "Rejeitadas", value: 2094, color: "#3b82f6" },
  { label: "Aguardando", value: 265, color: "#ec4899" },
];

export const rejectionReasons = [
  { reason: "Desconto falso (preço-âncora inflado)", count: 742, share: 35.4 },
  { reason: "Abaixo do desconto mínimo", count: 508, share: 24.3 },
  { reason: "Reputação do vendedor insuficiente", count: 361, share: 17.2 },
  { reason: "Duplicata recente (janela 72h)", count: 244, share: 11.7 },
  { reason: "Margem de afiliado insuficiente", count: 149, share: 7.1 },
  { reason: "Categoria bloqueada", count: 90, share: 4.3 },
];

export const aiAccuracy = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}`,
  precisao: Number((88.4 + Math.sin(i / 2.2) * 2.4 + i * 0.22).toFixed(1)),
  latencia: Number((1.9 - i * 0.031 + Math.cos(i / 3) * 0.14).toFixed(2)),
}));
