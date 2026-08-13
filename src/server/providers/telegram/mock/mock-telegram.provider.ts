import { createLogger } from "@/server/core/logger";
import type { TelegramProvider, SentMessage, SendOptions, ChannelInfo } from "../types";

const log = createLogger("telegram.mock");

let mockMessageCounter = 1000n;

/**
 * Mock Telegram Provider.
 *
 * Grava as mensagens no log em vez de enviá-las ao Telegram de verdade.
 * Permite testar o pipeline completo (detecção → IA → publicação) sem
 * precisar de um bot real.
 *
 * O messageId é um BigInt incremental — simula o que o Telegram faria.
 */
export const mockTelegramProvider: TelegramProvider = {
  key: "mock-telegram-v1",
  name: "Mock Telegram (log only)",

  async sendMessage(chatId: bigint, text: string, opts?: SendOptions): Promise<SentMessage> {
    mockMessageCounter++;

    log.info("📨 [MOCK TELEGRAM] Mensagem enviada", {
      chatId: String(chatId),
      messageId: String(mockMessageCounter),
      parseMode: opts?.parseMode ?? "MarkdownV2",
      hasMedia: !!opts?.mediaUrl,
      textLength: text.length,
      textPreview: text.slice(0, 200),
    });

    return {
      messageId: mockMessageCounter,
      chatId,
      sentAt: new Date(),
    };
  },

  async editMessage(chatId: bigint, messageId: bigint, text: string): Promise<void> {
    log.info("✏️ [MOCK TELEGRAM] Mensagem editada", {
      chatId: String(chatId),
      messageId: String(messageId),
      textLength: text.length,
    });
  },

  async deleteMessage(chatId: bigint, messageId: bigint): Promise<void> {
    log.info("🗑️ [MOCK TELEGRAM] Mensagem deletada", {
      chatId: String(chatId),
      messageId: String(messageId),
    });
  },

  async getChannelInfo(chatId: bigint): Promise<ChannelInfo> {
    return {
      chatId,
      title: "Mock Channel",
      memberCount: 1000,
      description: "Canal de teste do BeautyBot",
    };
  },

  async healthCheck() {
    return {
      healthy: true,
      latencyMs: 0,
      message: "Mock Telegram provider operacional",
    };
  },
};
