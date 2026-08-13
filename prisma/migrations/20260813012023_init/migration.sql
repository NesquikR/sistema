-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'AI', 'USER', 'CONNECTOR');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'OFFLINE', 'PAUSED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('OFFICIAL_API', 'AFFILIATE_API', 'SCRAPER', 'FEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('ATTRIBUTE', 'CAMPAIGN', 'CURATION', 'RISK');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('MANUAL', 'AI', 'RULE', 'IMPORT');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('SCHEDULED_SCAN', 'OFFER_DETECTION', 'MANUAL_CHECK', 'WEBHOOK', 'BACKFILL');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DETECTED', 'VALIDATED', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "DecisionSource" AS ENUM ('RULE_ENGINE', 'AI', 'MANUAL', 'AUTO_THRESHOLD');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING', 'CASHBACK', 'PROGRESSIVE');

-- CreateEnum
CREATE TYPE "AffiliateNetwork" AS ENUM ('SHOPEE_AFFILIATE', 'AMAZON_ASSOCIATES', 'MERCADO_LIVRE', 'AWIN', 'RAKUTEN', 'LOMADEE', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'DESKTOP', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "ParseMode" AS ENUM ('MARKDOWN_V2', 'HTML', 'PLAIN');

-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('OFFER_SCORING', 'COPYWRITING', 'CATEGORY_MAPPING', 'ANOMALY_DETECTION', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "AiVerdict" AS ENUM ('APPROVE', 'REJECT', 'REVIEW');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('FAKE_DISCOUNT', 'BELOW_MIN_DISCOUNT', 'LOW_SELLER_REPUTATION', 'DUPLICATE_RECENT', 'INSUFFICIENT_MARGIN', 'BLOCKED_CATEGORY', 'BLOCKED_BRAND', 'OUT_OF_STOCK', 'PRICE_INCONSISTENT', 'LOW_ENGAGEMENT_FORECAST', 'OTHER');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('THRESHOLD_TUNING', 'SCHEDULE_OPTIMIZATION', 'CATEGORY_FOCUS', 'RISK_MITIGATION', 'CHANNEL_ROUTING', 'CONNECTOR_HEALTH');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'REVIEWING', 'APPLIED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('STORE_SYNC', 'PRICE_STATS', 'AI_EVALUATION', 'PUBLISH_QUEUE', 'ANALYTICS_ROLLUP', 'RETENTION_CLEANUP', 'COUPON_VERIFY', 'HEALTH_CHECK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('CRON', 'MANUAL', 'API', 'RETRY', 'CHAIN');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'RESERVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('TRACE', 'DEBUG', 'INFO', 'SUCCESS', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "Granularity" AS ENUM ('MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "SettingScope" AS ENUM ('GLOBAL', 'STORE', 'CATEGORY', 'CHANNEL', 'USER');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET', 'DURATION', 'PERCENT');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('REVIEW_OFFER', 'VERIFY_COUPON', 'FIX_CONNECTOR', 'MAP_CATEGORY', 'REVIEW_SUGGESTION', 'MANUAL_CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "scopes" TEXT[],
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "homepage_url" TEXT,
    "logo_url" TEXT,
    "accent_color" TEXT,
    "connector_key" TEXT NOT NULL,
    "connector_version" TEXT NOT NULL DEFAULT '1.0.0',
    "integration_type" "IntegrationType" NOT NULL DEFAULT 'SCRAPER',
    "base_url" TEXT,
    "config" JSONB,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "quota_daily_limit" INTEGER,
    "quota_daily_used" INTEGER NOT NULL DEFAULT 0,
    "quota_reset_at" TIMESTAMPTZ(3),
    "default_commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "health_status" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_sync_at" TIMESTAMPTZ(3),
    "next_sync_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" INTEGER,
    "success_rate" DECIMAL(5,2),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credentials" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(3),
    "rotated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "accent_color" TEXT,
    "description" TEXT,
    "parent_id" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "min_discount_percent" INTEGER NOT NULL DEFAULT 30,
    "max_daily_posts" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_category_maps" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "external_category_id" TEXT NOT NULL,
    "external_path" TEXT,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "store_category_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "logo_url" TEXT,
    "website_url" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "quality_score" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "canonical_title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "brand_id" TEXT,
    "gtin" TEXT,
    "match_confidence" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    "match_strategy" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "product_group_id" TEXT,
    "brand_id" TEXT,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "canonical_url" TEXT,
    "sku" TEXT,
    "gtin" TEXT,
    "mpn" TEXT,
    "seller_name" TEXT,
    "seller_id" TEXT,
    "seller_reputation" DECIMAL(3,2),
    "rating" DECIMAL(2,1),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "sold_count_30d" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "current_price" DECIMAL(12,2),
    "list_price" DECIMAL(12,2),
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "attributes" JSONB,
    "content_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "local_path" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL DEFAULT 'ATTRIBUTE',
    "color" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tags" (
    "product_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "source" "TagSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DECIMAL(5,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" BIGSERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "execution_id" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "list_price" DECIMAL(12,2),
    "shipping_cost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "source" "PriceSource" NOT NULL DEFAULT 'SCHEDULED_SCAN',
    "observed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_statistics" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "window_days" INTEGER NOT NULL,
    "min_price" DECIMAL(12,2) NOT NULL,
    "max_price" DECIMAL(12,2) NOT NULL,
    "avg_price" DECIMAL(12,2) NOT NULL,
    "median_price" DECIMAL(12,2) NOT NULL,
    "p25_price" DECIMAL(12,2) NOT NULL,
    "std_deviation" DECIMAL(12,4),
    "sample_count" INTEGER NOT NULL,
    "min_price_at" TIMESTAMPTZ(3),
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    "brand_id" TEXT,
    "coupon_id" TEXT,
    "execution_id" TEXT,
    "affiliate_link_id" TEXT,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "previous_price" DECIMAL(12,2) NOT NULL,
    "reference_price" DECIMAL(12,2),
    "lowest_ever_price" DECIMAL(12,2),
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "below_average_pct" DECIMAL(5,2),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "free_shipping" BOOLEAN NOT NULL DEFAULT false,
    "shipping_cost" DECIMAL(12,2),
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "stock_estimate" INTEGER,
    "rating" DECIMAL(2,1),
    "review_count" INTEGER,
    "score" INTEGER,
    "status" "OfferStatus" NOT NULL DEFAULT 'DETECTED',
    "decision_source" "DecisionSource",
    "rejection_reason" "RejectionReason",
    "rejection_note" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "scheduled_for" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_prices" (
    "id" BIGSERIAL NOT NULL,
    "offer_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "list_price" DECIMAL(12,2),
    "discount_percent" DECIMAL(5,2),
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_status_events" (
    "id" BIGSERIAL NOT NULL,
    "offer_id" TEXT NOT NULL,
    "from_status" "OfferStatus",
    "to_status" "OfferStatus" NOT NULL,
    "reason" TEXT,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(12,2) NOT NULL,
    "max_discount" DECIMAL(12,2),
    "min_purchase" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "starts_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_first_purchase" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMPTZ(3),
    "source_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_programs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" "AffiliateNetwork" NOT NULL DEFAULT 'DIRECT',
    "tracking_tag" TEXT,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    "cookie_days" INTEGER NOT NULL DEFAULT 30,
    "payment_term_days" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "program_id" TEXT,
    "product_id" TEXT,
    "offer_id" TEXT,
    "original_url" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "short_slug" TEXT NOT NULL,
    "tracking_tag" TEXT,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "conversion_count" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" BIGSERIAL NOT NULL,
    "affiliate_link_id" TEXT NOT NULL,
    "offer_id" TEXT,
    "message_id" TEXT,
    "channel_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "device" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "country" TEXT,
    "region" TEXT,
    "referrer" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "is_unique" BOOLEAN NOT NULL DEFAULT true,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" BIGSERIAL NOT NULL,
    "store_id" TEXT NOT NULL,
    "affiliate_link_id" TEXT NOT NULL,
    "click_id" BIGINT,
    "offer_id" TEXT,
    "external_order_id" TEXT NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "order_value" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "commission_rate" DECIMAL(5,4),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_channels" (
    "id" TEXT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "invite_url" TEXT,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "default_template_id" TEXT,
    "posting_window_start" TEXT NOT NULL DEFAULT '08:00',
    "posting_window_end" TEXT NOT NULL DEFAULT '22:00',
    "max_posts_per_hour" INTEGER NOT NULL DEFAULT 6,
    "max_posts_per_day" INTEGER NOT NULL DEFAULT 60,
    "min_score_to_publish" INTEGER NOT NULL DEFAULT 70,
    "member_count_synced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "telegram_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_categories" (
    "channel_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("channel_id","category_id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parse_mode" "ParseMode" NOT NULL DEFAULT 'MARKDOWN_V2',
    "variables" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_messages" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT,
    "channel_id" TEXT NOT NULL,
    "template_id" TEXT,
    "affiliate_link_id" TEXT,
    "external_message_id" BIGINT,
    "rendered_text" TEXT NOT NULL,
    "media_url" TEXT,
    "parse_mode" "ParseMode" NOT NULL DEFAULT 'MARKDOWN_V2',
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "scheduled_for" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "conversion_count" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attempts" (
    "id" BIGSERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "http_status" INTEGER,
    "error_code" TEXT,
    "error_text" TEXT,
    "latency_ms" INTEGER,
    "retry_after" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "purpose" "AiPurpose" NOT NULL DEFAULT 'OFFER_SCORING',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "cost_per_1k_input" DECIMAL(10,6),
    "cost_per_1k_output" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "model_id" TEXT,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "purpose" "AiPurpose" NOT NULL DEFAULT 'OFFER_SCORING',
    "template" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "prompt_id" TEXT,
    "score" INTEGER NOT NULL,
    "verdict" "AiVerdict" NOT NULL,
    "confidence" DECIMAL(5,4),
    "rejection_reason" "RejectionReason",
    "reasons" TEXT[],
    "summary" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "latency_ms" INTEGER,
    "features" JSONB,
    "raw_response" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedbacks" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "user_id" TEXT,
    "human_verdict" "AiVerdict" NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "impact_estimate" TEXT,
    "impact_score" INTEGER,
    "payload" JSONB,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "applied_by_user_id" TEXT,
    "applied_at" TIMESTAMPTZ(3),
    "dismissed_reason" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_jobs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "job_type" "JobType" NOT NULL DEFAULT 'CUSTOM',
    "store_id" TEXT,
    "cron_expression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "concurrency_limit" INTEGER NOT NULL DEFAULT 1,
    "timeout_seconds" INTEGER NOT NULL DEFAULT 300,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "backoff_strategy" TEXT NOT NULL DEFAULT 'exponential',
    "payload" JSONB,
    "last_run_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "last_status" "ExecutionStatus",
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduler_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "job_id" TEXT,
    "store_id" TEXT,
    "parent_execution_id" TEXT,
    "trigger" "TriggerType" NOT NULL DEFAULT 'CRON',
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "duration_ms" INTEGER,
    "items_scanned" INTEGER NOT NULL DEFAULT 0,
    "items_new" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_skipped" INTEGER NOT NULL DEFAULT 0,
    "offers_created" INTEGER NOT NULL DEFAULT 0,
    "offers_published" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "correlation_id" TEXT,
    "stats" JSONB,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_steps" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "duration_ms" INTEGER,
    "input" JSONB,
    "output" JSONB,
    "error_text" TEXT,

    CONSTRAINT "execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" BIGSERIAL NOT NULL,
    "queue" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "error_text" TEXT,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" BIGSERIAL NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "execution_id" TEXT,
    "store_id" TEXT,
    "offer_id" TEXT,
    "correlation_id" TEXT,
    "duration_ms" INTEGER,
    "error_stack" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_samples" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT,
    "granularity" "Granularity" NOT NULL DEFAULT 'HOUR',
    "bucket_start" TIMESTAMPTZ(3) NOT NULL,
    "sample_count" INTEGER NOT NULL DEFAULT 1,
    "dimensions" JSONB,
    "dimensions_hash" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_analytics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "store_id" TEXT,
    "category_id" TEXT,
    "channel_id" TEXT,
    "dimension_key" TEXT NOT NULL DEFAULT '*:*:*',
    "products_scanned" INTEGER NOT NULL DEFAULT 0,
    "offers_detected" INTEGER NOT NULL DEFAULT 0,
    "offers_approved" INTEGER NOT NULL DEFAULT 0,
    "offers_published" INTEGER NOT NULL DEFAULT 0,
    "offers_rejected" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "unique_clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "order_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(5,2),
    "conversion_rate" DECIMAL(5,2),
    "avg_discount" DECIMAL(5,2),
    "avg_analysis_ms" INTEGER,
    "ai_cost_usd" DECIMAL(10,4),
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "SettingScope" NOT NULL DEFAULT 'GLOBAL',
    "scope_id" TEXT NOT NULL DEFAULT '',
    "value_type" "SettingValueType" NOT NULL DEFAULT 'STRING',
    "value" JSONB NOT NULL,
    "default_value" JSONB,
    "description" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_history" (
    "id" BIGSERIAL NOT NULL,
    "setting_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB NOT NULL,
    "changed_by_user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percent" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "action_url" TEXT,
    "dedupe_key" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'OTHER',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_user_id" TEXT,
    "offer_id" TEXT,
    "store_id" TEXT,
    "coupon_id" TEXT,
    "category_id" TEXT,
    "suggestion_id" TEXT,
    "due_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");

-- CreateIndex
CREATE INDEX "api_keys_user_id_revoked_at_idx" ON "api_keys"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stores_connector_key_key" ON "stores"("connector_key");

-- CreateIndex
CREATE INDEX "stores_is_active_next_sync_at_idx" ON "stores"("is_active", "next_sync_at");

-- CreateIndex
CREATE INDEX "stores_status_idx" ON "stores"("status");

-- CreateIndex
CREATE INDEX "store_credentials_store_id_rotated_at_idx" ON "store_credentials"("store_id", "rotated_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_credentials_store_id_key_version_key" ON "store_credentials"("store_id", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "store_category_maps_category_id_idx" ON "store_category_maps"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_category_maps_store_id_external_category_id_key" ON "store_category_maps"("store_id", "external_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_normalized_name_key" ON "brands"("normalized_name");

-- CreateIndex
CREATE INDEX "brands_is_blocked_idx" ON "brands"("is_blocked");

-- CreateIndex
CREATE INDEX "product_groups_brand_id_normalized_title_idx" ON "product_groups"("brand_id", "normalized_title");

-- CreateIndex
CREATE INDEX "product_groups_gtin_idx" ON "product_groups"("gtin");

-- CreateIndex
CREATE INDEX "products_store_id_last_seen_at_idx" ON "products"("store_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "products_category_id_is_active_idx" ON "products"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_product_group_id_idx" ON "products"("product_group_id");

-- CreateIndex
CREATE INDEX "products_normalized_title_idx" ON "products"("normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_external_id_key" ON "products"("store_id", "external_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_is_primary_idx" ON "product_images"("product_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_kind_idx" ON "tags"("kind");

-- CreateIndex
CREATE INDEX "product_tags_tag_id_idx" ON "product_tags"("tag_id");

-- CreateIndex
CREATE INDEX "price_observations_product_id_observed_at_idx" ON "price_observations"("product_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "price_observations_observed_at_idx" ON "price_observations"("observed_at");

-- CreateIndex
CREATE INDEX "price_observations_store_id_observed_at_idx" ON "price_observations"("store_id", "observed_at");

-- CreateIndex
CREATE INDEX "price_statistics_computed_at_idx" ON "price_statistics"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_statistics_product_id_window_days_key" ON "price_statistics"("product_id", "window_days");

-- CreateIndex
CREATE UNIQUE INDEX "offers_dedupe_key_key" ON "offers"("dedupe_key");

-- CreateIndex
CREATE INDEX "offers_status_detected_at_idx" ON "offers"("status", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "offers_product_id_detected_at_idx" ON "offers"("product_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "offers_category_id_status_idx" ON "offers"("category_id", "status");

-- CreateIndex
CREATE INDEX "offers_store_id_status_idx" ON "offers"("store_id", "status");

-- CreateIndex
CREATE INDEX "offers_score_idx" ON "offers"("score" DESC);

-- CreateIndex
CREATE INDEX "offers_scheduled_for_idx" ON "offers"("scheduled_for");

-- CreateIndex
CREATE INDEX "offer_prices_offer_id_captured_at_idx" ON "offer_prices"("offer_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "offer_status_events_offer_id_created_at_idx" ON "offer_status_events"("offer_id", "created_at");

-- CreateIndex
CREATE INDEX "offer_status_events_to_status_created_at_idx" ON "offer_status_events"("to_status", "created_at");

-- CreateIndex
CREATE INDEX "coupons_store_id_is_active_expires_at_idx" ON "coupons"("store_id", "is_active", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_store_id_code_key" ON "coupons"("store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_programs_store_id_network_key" ON "affiliate_programs"("store_id", "network");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_short_slug_key" ON "affiliate_links"("short_slug");

-- CreateIndex
CREATE INDEX "affiliate_links_offer_id_idx" ON "affiliate_links"("offer_id");

-- CreateIndex
CREATE INDEX "affiliate_links_store_id_created_at_idx" ON "affiliate_links"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_links_product_id_idx" ON "affiliate_links"("product_id");

-- CreateIndex
CREATE INDEX "clicks_affiliate_link_id_occurred_at_idx" ON "clicks"("affiliate_link_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clicks_message_id_occurred_at_idx" ON "clicks"("message_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clicks_occurred_at_idx" ON "clicks"("occurred_at");

-- CreateIndex
CREATE INDEX "conversions_status_occurred_at_idx" ON "conversions"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "conversions_affiliate_link_id_occurred_at_idx" ON "conversions"("affiliate_link_id", "occurred_at");

-- CreateIndex
CREATE INDEX "conversions_offer_id_idx" ON "conversions"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversions_store_id_external_order_id_key" ON "conversions"("store_id", "external_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_channels_chat_id_key" ON "telegram_channels"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_channels_handle_key" ON "telegram_channels"("handle");

-- CreateIndex
CREATE INDEX "telegram_channels_is_active_idx" ON "telegram_channels"("is_active");

-- CreateIndex
CREATE INDEX "channel_categories_category_id_idx" ON "channel_categories"("category_id");

-- CreateIndex
CREATE INDEX "message_templates_is_active_idx" ON "message_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_slug_version_key" ON "message_templates"("slug", "version");

-- CreateIndex
CREATE INDEX "telegram_messages_status_scheduled_for_idx" ON "telegram_messages"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "telegram_messages_channel_id_sent_at_idx" ON "telegram_messages"("channel_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "telegram_messages_offer_id_idx" ON "telegram_messages"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_messages_channel_id_external_message_id_key" ON "telegram_messages"("channel_id", "external_message_id");

-- CreateIndex
CREATE INDEX "message_attempts_created_at_idx" ON "message_attempts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_attempts_message_id_attempt_no_key" ON "message_attempts"("message_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_key_key" ON "ai_models"("key");

-- CreateIndex
CREATE INDEX "ai_models_purpose_is_active_idx" ON "ai_models"("purpose", "is_active");

-- CreateIndex
CREATE INDEX "ai_prompts_is_active_idx" ON "ai_prompts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_key_version_key" ON "ai_prompts"("key", "version");

-- CreateIndex
CREATE INDEX "ai_analyses_offer_id_created_at_idx" ON "ai_analyses"("offer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_analyses_model_id_created_at_idx" ON "ai_analyses"("model_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_analyses_verdict_created_at_idx" ON "ai_analyses"("verdict", "created_at");

-- CreateIndex
CREATE INDEX "ai_analyses_rejection_reason_idx" ON "ai_analyses"("rejection_reason");

-- CreateIndex
CREATE INDEX "ai_feedbacks_analysis_id_idx" ON "ai_feedbacks"("analysis_id");

-- CreateIndex
CREATE INDEX "ai_feedbacks_agreed_created_at_idx" ON "ai_feedbacks"("agreed", "created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_status_created_at_idx" ON "ai_suggestions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_suggestions_type_idx" ON "ai_suggestions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_jobs_key_key" ON "scheduler_jobs"("key");

-- CreateIndex
CREATE INDEX "scheduler_jobs_is_enabled_next_run_at_idx" ON "scheduler_jobs"("is_enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduler_jobs_job_type_idx" ON "scheduler_jobs"("job_type");

-- CreateIndex
CREATE INDEX "executions_job_id_started_at_idx" ON "executions"("job_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "executions_store_id_started_at_idx" ON "executions"("store_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "executions_status_started_at_idx" ON "executions"("status", "started_at");

-- CreateIndex
CREATE INDEX "executions_correlation_id_idx" ON "executions"("correlation_id");

-- CreateIndex
CREATE INDEX "execution_steps_status_idx" ON "execution_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "execution_steps_execution_id_sequence_key" ON "execution_steps"("execution_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "queue_jobs_dedupe_key_key" ON "queue_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "queue_jobs_queue_status_available_at_priority_idx" ON "queue_jobs"("queue", "status", "available_at", "priority");

-- CreateIndex
CREATE INDEX "queue_jobs_status_locked_at_idx" ON "queue_jobs"("status", "locked_at");

-- CreateIndex
CREATE INDEX "logs_created_at_idx" ON "logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "logs_level_created_at_idx" ON "logs"("level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "logs_source_created_at_idx" ON "logs"("source", "created_at" DESC);

-- CreateIndex
CREATE INDEX "logs_correlation_id_idx" ON "logs"("correlation_id");

-- CreateIndex
CREATE INDEX "logs_execution_id_idx" ON "logs"("execution_id");

-- CreateIndex
CREATE INDEX "metric_samples_name_bucket_start_idx" ON "metric_samples"("name", "bucket_start" DESC);

-- CreateIndex
CREATE INDEX "metric_samples_bucket_start_idx" ON "metric_samples"("bucket_start");

-- CreateIndex
CREATE UNIQUE INDEX "metric_samples_name_granularity_bucket_start_dimensions_has_key" ON "metric_samples"("name", "granularity", "bucket_start", "dimensions_hash");

-- CreateIndex
CREATE INDEX "daily_analytics_date_idx" ON "daily_analytics"("date" DESC);

-- CreateIndex
CREATE INDEX "daily_analytics_store_id_date_idx" ON "daily_analytics"("store_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_analytics_date_dimension_key_key" ON "daily_analytics"("date", "dimension_key");

-- CreateIndex
CREATE INDEX "settings_key_idx" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_scope_scope_id_key" ON "settings"("key", "scope", "scope_id");

-- CreateIndex
CREATE INDEX "setting_history_setting_id_created_at_idx" ON "setting_history"("setting_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_is_read_created_at_idx" ON "notifications"("is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_severity_created_at_idx" ON "notifications"("severity", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_status_priority_due_at_idx" ON "tasks"("status", "priority", "due_at");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_status_idx" ON "tasks"("assigned_user_id", "status");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credentials" ADD CONSTRAINT "store_credentials_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_category_maps" ADD CONSTRAINT "store_category_maps_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_category_maps" ADD CONSTRAINT "store_category_maps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_statistics" ADD CONSTRAINT "price_statistics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_affiliate_link_id_fkey" FOREIGN KEY ("affiliate_link_id") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_prices" ADD CONSTRAINT "offer_prices_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_status_events" ADD CONSTRAINT "offer_status_events_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "affiliate_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_affiliate_link_id_fkey" FOREIGN KEY ("affiliate_link_id") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "telegram_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "telegram_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_affiliate_link_id_fkey" FOREIGN KEY ("affiliate_link_id") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_click_id_fkey" FOREIGN KEY ("click_id") REFERENCES "clicks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_channels" ADD CONSTRAINT "telegram_channels_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "telegram_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "telegram_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_affiliate_link_id_fkey" FOREIGN KEY ("affiliate_link_id") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attempts" ADD CONSTRAINT "message_attempts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "telegram_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ai_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_applied_by_user_id_fkey" FOREIGN KEY ("applied_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduler_jobs" ADD CONSTRAINT "scheduler_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scheduler_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_parent_execution_id_fkey" FOREIGN KEY ("parent_execution_id") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "telegram_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_history" ADD CONSTRAINT "setting_history_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_history" ADD CONSTRAINT "setting_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "ai_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
