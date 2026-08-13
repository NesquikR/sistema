import type { Prisma, AiAnalysis, AiVerdict } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, type DbClient } from "./base.repository";

/**
 * Repositório do domínio de inteligência.
 *
 * AiAnalysis é append-only: reavaliar uma oferta cria nova análise, nunca
 * sobrescreve. Isso preserva o histórico de decisões e habilita comparação
 * de acurácia entre modelos.
 */

export interface CreateAnalysisInput {
  offerId: string;
  modelId: string;
  promptId?: string;
  score: number;
  verdict: AiVerdict;
  confidence?: number;
  rejectionReason?: string;
  reasons: string[];
  summary?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  features?: Prisma.InputJsonValue;
  rawResponse?: Prisma.InputJsonValue;
}

export class AiRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new AiRepository(tx);
  }

  /** Cria uma análise. Append-only. */
  async createAnalysis(input: CreateAnalysisInput): Promise<AiAnalysis> {
    return this.client.aiAnalysis.create({
      data: {
        offerId: input.offerId,
        modelId: input.modelId,
        promptId: input.promptId,
        score: input.score,
        verdict: input.verdict,
        confidence: input.confidence,
        rejectionReason: input.rejectionReason as never,
        reasons: input.reasons,
        summary: input.summary,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costUsd: input.costUsd,
        latencyMs: input.latencyMs,
        features: input.features ?? undefined,
        rawResponse: input.rawResponse ?? undefined,
      },
    });
  }

  /** Última análise de uma oferta. */
  findLatestForOffer(offerId: string) {
    return this.client.aiAnalysis.findFirst({
      where: { offerId },
      orderBy: { createdAt: "desc" },
      include: { model: { select: { key: true, provider: true, modelId: true } } },
    });
  }

  /** Análises recentes — alimenta o widget "Análises recentes da IA" no dashboard. */
  findRecent(limit = 20) {
    return this.client.aiAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        offer: {
          select: { id: true, title: true, price: true, discountPercent: true, status: true },
        },
        model: { select: { key: true, provider: true } },
      },
    });
  }

  /** Busca o modelo de IA ativo para um propósito. */
  findActiveModel(purpose: "OFFER_SCORING" | "COPYWRITING" | "CATEGORY_MAPPING" | "ANOMALY_DETECTION" | "SUGGESTION") {
    return this.client.aiModel.findFirst({
      where: { purpose, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** Busca o prompt ativo para um propósito. */
  findActivePrompt(purpose: "OFFER_SCORING" | "COPYWRITING" | "CATEGORY_MAPPING" | "ANOMALY_DETECTION" | "SUGGESTION") {
    return this.client.aiPrompt.findFirst({
      where: { purpose, isActive: true },
      orderBy: { version: "desc" },
    });
  }

  /** Grava feedback humano sobre uma decisão da IA. */
  async createFeedback(analysisId: string, humanVerdict: AiVerdict, agreed: boolean, userId?: string, notes?: string) {
    return this.client.aiFeedback.create({
      data: { analysisId, humanVerdict, agreed, userId, notes },
    });
  }

  /** Contadores por veredicto — alimenta o donut do dashboard. */
  async countByVerdict(since?: Date) {
    return this.client.aiAnalysis.groupBy({
      by: ["verdict"],
      where: since ? { createdAt: { gte: since } } : {},
      _count: { _all: true },
    });
  }

  /** Métricas de custo e latência. */
  async costSummary(since?: Date) {
    return this.client.aiAnalysis.aggregate({
      where: since ? { createdAt: { gte: since } } : {},
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _avg: { latencyMs: true, score: true },
      _count: { _all: true },
    });
  }
}

export const aiRepository = new AiRepository(db as DbClient);
