import type { Prisma, TelegramMessage, MessageStatus } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, toPage, type DbClient, type Page } from "./base.repository";

/**
 * Repositório de publicação (Telegram).
 *
 * Gerencia mensagens, tentativas de envio e canais. Cada mensagem é imutável
 * por versão (o renderedText é snapshot do que o público viu). Tentativas de
 * envio são append-only para diagnóstico de rate limiting e falhas.
 */

export interface MessageFilter {
  channelId?: string;
  offerId?: string;
  status?: MessageStatus | MessageStatus[];
  limit?: number;
  offset?: number;
}

export interface CreateMessageInput {
  offerId?: string;
  channelId: string;
  templateId?: string;
  affiliateLinkId?: string;
  renderedText: string;
  mediaUrl?: string;
  parseMode?: "MARKDOWN_V2" | "HTML" | "PLAIN";
  status?: MessageStatus;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  scheduledFor?: Date;
}

export class TelegramRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new TelegramRepository(tx);
  }

  async findMessages(filter: MessageFilter = {}): Promise<Page<TelegramMessage>> {
    const { limit = 50, offset = 0 } = filter;

    const statusFilter = filter.status
      ? Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status
      : undefined;

    const where: Prisma.TelegramMessageWhereInput = {
      ...(filter.channelId ? { channelId: filter.channelId } : {}),
      ...(filter.offerId ? { offerId: filter.offerId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [items, total] = await Promise.all([
      this.client.telegramMessage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        include: {
          offer: { select: { id: true, title: true, price: true, discountPercent: true } },
          channel: { select: { id: true, title: true, handle: true } },
        },
        take: limit,
        skip: offset,
      }),
      this.client.telegramMessage.count({ where }),
    ]);

    return toPage(items, total, limit, offset);
  }

  findMessageById(id: string) {
    return this.client.telegramMessage.findUnique({
      where: { id },
      include: {
        offer: true,
        channel: true,
        template: true,
        affiliateLink: true,
        deliveries: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async createMessage(input: CreateMessageInput): Promise<TelegramMessage> {
    return this.client.telegramMessage.create({
      data: {
        offerId: input.offerId,
        channelId: input.channelId,
        templateId: input.templateId,
        affiliateLinkId: input.affiliateLinkId,
        renderedText: input.renderedText,
        mediaUrl: input.mediaUrl,
        parseMode: input.parseMode ?? "MARKDOWN_V2",
        status: input.status ?? "DRAFT",
        priority: input.priority ?? "NORMAL",
        scheduledFor: input.scheduledFor,
      },
    });
  }

  /** Atualiza o status e dados do Telegram após envio. */
  async markSent(id: string, externalMessageId: bigint) {
    return this.client.telegramMessage.update({
      where: { id },
      data: {
        status: "SENT",
        externalMessageId,
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markFailed(id: string, reason: string) {
    return this.client.telegramMessage.update({
      where: { id },
      data: {
        status: "FAILED",
        failureReason: reason,
        attempts: { increment: 1 },
      },
    });
  }

  /** Registra uma tentativa de envio (append-only). */
  async recordAttempt(
    messageId: string,
    attemptNo: number,
    result: { success: boolean; httpStatus?: number; errorCode?: string; errorText?: string; latencyMs?: number; retryAfter?: number },
  ) {
    return this.client.messageAttempt.create({
      data: {
        messageId,
        attemptNo,
        success: result.success,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        errorText: result.errorText,
        latencyMs: result.latencyMs,
        retryAfter: result.retryAfter,
      },
    });
  }

  /** Canais ativos. */
  findActiveChannels() {
    return this.client.telegramChannel.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { title: "asc" }],
      include: {
        categories: {
          include: { category: { select: { id: true, slug: true, name: true } } },
        },
      },
    });
  }

  /** Canal primário. */
  findPrimaryChannel() {
    return this.client.telegramChannel.findFirst({
      where: { isPrimary: true, isActive: true, deletedAt: null },
    });
  }

  /** Mensagens enviadas hoje para um canal (para throttling). */
  async countSentToday(channelId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.client.telegramMessage.count({
      where: {
        channelId,
        status: "SENT",
        sentAt: { gte: todayStart },
      },
    });
  }

  /** Mensagens enviadas na última hora para um canal (para throttling). */
  async countSentLastHour(channelId: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return this.client.telegramMessage.count({
      where: {
        channelId,
        status: "SENT",
        sentAt: { gte: oneHourAgo },
      },
    });
  }

  /** Template padrão ativo. */
  findDefaultTemplate() {
    return this.client.messageTemplate.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { version: "desc" },
    });
  }
}

export const telegramRepository = new TelegramRepository(db as DbClient);
