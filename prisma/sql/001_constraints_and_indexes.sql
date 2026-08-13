-- ============================================================================
-- BeautyBot — o que o Prisma não expressa
--
-- Aplique DEPOIS da primeira `prisma migrate dev`, copiando este conteúdo
-- para dentro da migration gerada (ou executando via `prisma db execute`).
-- São os 10% que sustentam a escala: CHECKs, índices parciais e GIN.
--
-- Racional de cada bloco: docs/DATABASE.md §12
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints — invariantes que o banco deve garantir sozinho
-- ---------------------------------------------------------------------------
ALTER TABLE offers
  ADD CONSTRAINT ck_offers_discount_range
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

ALTER TABLE offers
  ADD CONSTRAINT ck_offers_price_consistency
  CHECK (price > 0 AND price <= previous_price);

ALTER TABLE price_observations
  ADD CONSTRAINT ck_price_observations_positive
  CHECK (price > 0);

ALTER TABLE products
  ADD CONSTRAINT ck_products_rating_range
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

ALTER TABLE products
  ADD CONSTRAINT ck_products_review_count
  CHECK (review_count >= 0);

ALTER TABLE ai_analyses
  ADD CONSTRAINT ck_ai_analyses_score_range
  CHECK (score >= 0 AND score <= 100);

ALTER TABLE ai_analyses
  ADD CONSTRAINT ck_ai_analyses_confidence_range
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

ALTER TABLE stores
  ADD CONSTRAINT ck_stores_commission_rate
  CHECK (default_commission_rate >= 0 AND default_commission_rate <= 1);

ALTER TABLE coupons
  ADD CONSTRAINT ck_coupons_period
  CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at);

ALTER TABLE coupons
  ADD CONSTRAINT ck_coupons_value
  CHECK (value >= 0);

ALTER TABLE queue_jobs
  ADD CONSTRAINT ck_queue_jobs_attempts
  CHECK (attempts <= max_attempts);

ALTER TABLE categories
  ADD CONSTRAINT ck_categories_min_discount
  CHECK (min_discount_percent >= 0 AND min_discount_percent <= 100);

-- ---------------------------------------------------------------------------
-- 3. Índices parciais — indexam só o subconjunto que é realmente consultado
-- ---------------------------------------------------------------------------

-- O banco impede publicar a mesma oferta duas vezes no mesmo canal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_offer_channel_live
  ON telegram_messages (offer_id, channel_id)
  WHERE status IN ('SCHEDULED', 'SENT') AND offer_id IS NOT NULL;

-- Fila de revisão da Central de Operações, já ordenada.
CREATE INDEX IF NOT EXISTS ix_offers_review_queue
  ON offers (score DESC, detected_at DESC)
  WHERE status = 'PENDING_REVIEW';

-- Publicação pendente: a query mais frequente do worker.
CREATE INDEX IF NOT EXISTS ix_messages_due
  ON telegram_messages (scheduled_for)
  WHERE status IN ('QUEUED', 'SCHEDULED');

-- GTIN é único quando existe, mas a maioria dos produtos não tem.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_groups_gtin
  ON product_groups (gtin)
  WHERE gtin IS NOT NULL;

-- Soft delete: as consultas normais só enxergam linhas vivas.
CREATE INDEX IF NOT EXISTS ix_products_active
  ON products (store_id, last_seen_at DESC)
  WHERE deleted_at IS NULL AND is_active = true;

-- Conversões ainda não confirmadas — as que precisam de acompanhamento.
CREATE INDEX IF NOT EXISTS ix_conversions_pending
  ON conversions (occurred_at DESC)
  WHERE status = 'PENDING';

-- Alertas não lidos.
CREATE INDEX IF NOT EXISTS ix_notifications_unread
  ON notifications (created_at DESC)
  WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- 4. Índices GIN
-- ---------------------------------------------------------------------------

-- Busca textual tolerante a erro de digitação ("protetor solr" acha o produto).
CREATE INDEX IF NOT EXISTS ix_products_title_trgm
  ON products USING gin (normalized_title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_offers_title_trgm
  ON offers USING gin (title gin_trgm_ops);

-- Consulta dentro do JSON estruturado dos logs.
CREATE INDEX IF NOT EXISTS ix_logs_context_gin
  ON logs USING gin (context jsonb_path_ops);

CREATE INDEX IF NOT EXISTS ix_products_attributes_gin
  ON products USING gin (attributes jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- 5. Autovacuum agressivo na fila (alta rotatividade de linhas mortas)
-- ---------------------------------------------------------------------------
ALTER TABLE queue_jobs SET (
  autovacuum_vacuum_scale_factor  = 0.01,
  autovacuum_analyze_scale_factor = 0.01
);

ALTER TABLE offers SET (
  autovacuum_vacuum_scale_factor  = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);

-- ---------------------------------------------------------------------------
-- 6. Particionamento — aplicar quando as tabelas de evento passarem de ~1 M
--
--    Não é feito agora de propósito: particionar cedo demais só adiciona
--    complexidade. O schema já está preparado (chave BigInt, append-only,
--    coluna temporal indexada), então a migração é mecânica quando chegar
--    a hora. Roteiro:
--
--    a) renomear a tabela  → price_observations_legacy
--    b) criar a particionada:
--         CREATE TABLE price_observations (LIKE price_observations_legacy
--           INCLUDING ALL) PARTITION BY RANGE (observed_at);
--    c) criar partições mensais e migrar em lotes
--    d) agendar criação da partição do mês seguinte via pg_cron
--
--    Mesmo roteiro para clicks (occurred_at) e logs (created_at).
-- ---------------------------------------------------------------------------
