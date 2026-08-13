/**
 * Contrato dos provedores de publicação (Telegram).
 *
 * Desacoplado para que o dia em que um bot real for configurado, ou se
 * trocarmos para outro canal (Discord, WhatsApp), o núcleo não mude.
 */

export interface SendOptions {
  parseMode?: "MarkdownV2" | "HTML";
  mediaUrl?: string;
  disableNotification?: boolean;
  replyMarkup?: unknown;
}

export interface SentMessage {
  messageId: bigint;
  chatId: bigint;
  sentAt: Date;
}

export interface ChannelInfo {
  chatId: bigint;
  title: string;
  memberCount: number;
  description?: string;
}

export interface TelegramProvider {
  readonly key: string;
  readonly name: string;

  sendMessage(chatId: bigint, text: string, opts?: SendOptions): Promise<SentMessage>;
  editMessage?(chatId: bigint, messageId: bigint, text: string): Promise<void>;
  deleteMessage?(chatId: bigint, messageId: bigint): Promise<void>;
  getChannelInfo?(chatId: bigint): Promise<ChannelInfo>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;
}
