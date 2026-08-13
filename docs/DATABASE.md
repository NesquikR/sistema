# BeautyBot — Arquitetura do Banco de Dados

PostgreSQL 16 + Prisma ORM. Documento de referência da modelagem: princípios,
domínios, tabela a tabela, e o racional por trás de cada decisão.

---

## 1. Princípios que governam toda a modelagem

Antes das tabelas, as sete regras das quais tudo o mais deriva. Elas existem para
que o banco continue saudável no ano 5, não apenas no mês 1.

### 1.1. Duas classes de dados, dois tratamentos

A distinção mais importante do schema. Nem toda tabela tem o mesmo ciclo de vida,
e tratá-las igual é o erro que trava sistemas de monitoramento com o tempo.

| Classe | Natureza | Exemplos | Tratamento |
| --- | --- | --- | --- |
| **Catálogo (OLTP mutável)** | Poucas linhas, muitas leituras, atualização in-place | `Store`, `Product`, `Category`, `Coupon`, `Setting` | Chave `cuid`, `updatedAt`, soft delete, índices de busca |
| **Eventos (append-only)** | Crescimento linear e ilimitado, nunca sofrem `UPDATE` | `PriceObservation`, `Click`, `Log`, `MetricSample` | Chave `BigInt` sequencial, sem `updatedAt`, particionamento por tempo, retenção |

Um sistema que varre 50 mil produtos a cada 15 minutos gera **~1,7 bilhão de
observações de preço em cinco anos**. Se `PriceObservation` fosse uma tabela comum
com `cuid` e `updatedAt`, o índice primário sozinho passaria de 100 GB e cada
`VACUUM` se tornaria um evento operacional. Por isso ela é append-only, com chave
inteira sequencial (índice compacto, inserção sempre na folha mais à direita) e
preparada para particionamento mensal.

### 1.2. Estratégia de chaves primárias

- **Entidades de catálogo → `String @id @default(cuid())`.** Ordenável no tempo,
  seguro para aparecer em URLs e logs, e — decisivo — permite que a aplicação gere
  o ID **antes** do `INSERT`, o que simplifica escrita em lote e idempotência de
  conectores.
- **Tabelas de evento → `BigInt @id @default(autoincrement())`.** 8 bytes contra
  ~25 de um cuid. Multiplicado por bilhões de linhas e replicado em cada índice
  secundário, é a diferença entre um banco que cabe em memória e um que não cabe.
- **UUIDv4 foi descartado.** Aleatório, ele espalha as inserções por toda a
  B-tree, causando fragmentação e write amplification exatamente nas tabelas de
  maior volume.

### 1.3. Dinheiro nunca é ponto flutuante

Todo valor monetário é `Decimal @db.Decimal(12, 2)`; taxas e percentuais são
`Decimal(5, 4)` ou `Decimal(5, 2)`. `Float` acumula erro de arredondamento, e
receita de afiliado é conciliada contra extratos reais — divergência de centavos
é retrabalho garantido. Toda tabela com valor carrega `currency` (ISO 4217), mesmo
que hoje só exista `BRL`: adicionar a coluna depois, com milhões de linhas, exige
janela de manutenção.

### 1.4. Tempo é sempre `timestamptz`

Todo campo temporal é `DateTime @db.Timestamptz(3)`. O sistema opera em
`America/Sao_Paulo`, mas horário de verão, servidores em UTC e APIs estrangeiras
tornam `timestamp without time zone` uma fonte silenciosa de erro. Armazena-se em
UTC; a conversão é responsabilidade da apresentação.

### 1.5. Normalizado por padrão, desnormalizado por decisão

O núcleo é normalizado (3FN). Existem exatamente **três** desvios deliberados, cada
um justificado:

1. **`Offer` guarda snapshot** de `title`, `price` e `previousPrice` do momento da
   detecção. Uma oferta é um *fato histórico*: se o produto mudar de nome ou preço,
   a oferta publicada não pode mudar retroativamente.
2. **`TelegramMessage` guarda contadores** de `clickCount`/`conversionCount`/
   `revenue`. Contar bilhões de cliques a cada abertura da tela de Enviadas é
   inviável; os contadores são incrementados na escrita.
3. **`DailyAnalytics` e `PriceStatistic` são rollups** — dados deriváveis,
   materializados porque o custo de recalcular supera o de armazenar.

Todo campo desnormalizado é reconstruível a partir dos eventos brutos. Isso é o que
torna o desvio seguro: o dado bruto continua sendo a fonte da verdade.

### 1.6. Enums no banco, não strings livres

Status, níveis e tipos são `enum` nativos do PostgreSQL. Custam 4 bytes, são
validados pelo próprio banco e o Prisma os expõe como união de tipos no TypeScript
— um `status: "publicadaa"` vira erro de compilação, não linha corrompida.
Enums crescem com `ALTER TYPE ... ADD VALUE`, sem reescrever a tabela.

### 1.7. Nada é apagado de verdade

Entidades de catálogo usam **soft delete** (`deletedAt`). Excluir uma loja com
200 mil produtos e um histórico de receita associado destruiria a série histórica.
`deletedAt` preserva integridade referencial e mantém os relatórios corretos.
Eventos antigos saem por **retenção** (drop de partição), não por `DELETE`.

---

## 2. Mapa de domínios

O schema se organiza em nove domínios. A regra de dependência é: domínios de baixo
dependem dos de cima, nunca o contrário.

```
┌─ IDENTIDADE ──────────┐   User · ApiKey · AuditLog
│
├─ CATÁLOGO ────────────┐   Store · StoreCredential · StoreCategoryMap
│                           Brand · Category · Tag
│                           ProductGroup · Product · ProductImage · ProductTag
│
├─ PRECIFICAÇÃO ────────┐   PriceObservation · PriceStatistic
│
├─ OFERTAS ─────────────┐   Offer · OfferPrice · OfferStatusEvent · Coupon
│
├─ MONETIZAÇÃO ─────────┐   AffiliateProgram · AffiliateLink · Click · Conversion
│
├─ PUBLICAÇÃO ──────────┐   TelegramChannel · ChannelCategory
│                           MessageTemplate · TelegramMessage · MessageAttempt
│
├─ INTELIGÊNCIA ────────┐   AiModel · AiPrompt · AiAnalysis · AiFeedback · AiSuggestion
│
├─ ORQUESTRAÇÃO ────────┐   SchedulerJob · Execution · ExecutionStep · QueueJob
│
└─ OBSERVABILIDADE ─────┘   Log · MetricSample · DailyAnalytics
                            Setting · SettingHistory · FeatureFlag
                            Notification · Task
```

### O fluxo, em termos de tabelas

```
SchedulerJob  →  Execution  →  ExecutionStep
                     │
                     ├─→ Product (upsert)  ─→ ProductImage
                     ├─→ PriceObservation (append)  ─→ PriceStatistic (rollup)
                     └─→ Offer (create)
                              │
                              ├─→ AiAnalysis  ─→ AiFeedback
                              ├─→ OfferStatusEvent (cada transição)
                              ├─→ AffiliateLink
                              └─→ TelegramMessage  ─→ MessageAttempt
                                        │
                                        └─→ Click  ─→ Conversion  ─→ DailyAnalytics
```

---

## 3. Domínio: Identidade

Hoje há um único operador e nenhuma tela de login. Estas tabelas existem mesmo
assim, por um motivo específico: **`AuditLog` e todos os campos `*ByUserId` precisam
de um alvo de FK desde o primeiro dia**. Adicionar autoria a um banco com histórico
já acumulado obriga a backfill com valores inventados. Com a tabela presente, o
sistema grava hoje o operador padrão e, no dia em que existir um segundo usuário,
nada muda no schema.

### `User`
- **Finalidade.** Ator do sistema. Hoje, uma linha (`role = OWNER`).
- **Relacionamentos.** 1:N com `ApiKey`, `AuditLog`, `AiFeedback`, `AiSuggestion`
  (aplicada por), `Task`, `SettingHistory`.
- **Chaves e índices.** PK `cuid`; `email` único; índice em `isActive`.
- **Constraints.** `email` obrigatório e citext-like (normalizado em minúsculas na
  aplicação); `role` enum.
- **Atualização.** Mutável, soft delete. `lastLoginAt` por `UPDATE` direto.

### `ApiKey`
- **Finalidade.** Autenticação máquina-a-máquina — webhooks de rede de afiliados,
  scripts externos, um app móvel futuro.
- **Relacionamentos.** N:1 `User`.
- **Chaves e índices.** PK `cuid`; `hashedKey` único; índice em `(userId, revokedAt)`.
- **Constraints.** Nunca se armazena a chave em claro — só o hash e um `prefix` de
  8 caracteres para exibição ("bb_live_a1b2…").
- **Atualização.** Imutável após criação, exceto `lastUsedAt` e `revokedAt`.
  Rotação é criar nova + revogar antiga, nunca editar.

### `AuditLog`
- **Finalidade.** Quem mudou o quê, quando, de qual valor para qual. Responde à
  pergunta que sempre aparece meses depois: "por que esse limiar está em 45%?".
- **Relacionamentos.** N:1 `User` (opcional — o ator pode ser `SYSTEM` ou `AI`).
- **Chaves e índices.** PK `BigInt`; índices em `(entityType, entityId, createdAt)`
  e `(actorId, createdAt)`.
- **Constraints.** `before`/`after` em `Jsonb`, permitindo auditar qualquer entidade
  sem uma tabela de auditoria por tabela.
- **Atualização.** **Append-only.** Nunca sofre `UPDATE` ou `DELETE`.

---

## 4. Domínio: Catálogo

### `Store`
- **Finalidade.** Uma loja integrada. É a raiz da árvore de dados: produtos, ofertas,
  cupons e credenciais pendem dela.
- **Relacionamentos.** 1:N `Product`, `Offer`, `Coupon`, `StoreCredential`,
  `AffiliateProgram`, `Execution`, `StoreCategoryMap`.
- **Chaves e índices.** PK `cuid`; `slug` e `connectorKey` únicos; índice em
  `(isActive, nextSyncAt)` — a query mais quente do scheduler ("quais conectores
  rodam agora").
- **Constraints.** `commissionRate` entre 0 e 1 (CHECK); `integrationType` enum
  (`OFFICIAL_API`, `AFFILIATE_API`, `SCRAPER`, `FEED`); `currency` ISO 4217.
- **Atualização.** Configuração muda raramente (manual). Campos de saúde —
  `healthStatus`, `lastSyncAt`, `consecutiveFailures` — são escritos a cada
  execução. **Decisão consciente:** eles vivem aqui, não em tabela separada, porque
  a Central de Operações lê o estado atual de 5 lojas a cada poucos segundos; um
  `JOIN` com agregação seria desperdício.

### `StoreCredential`
- **Finalidade.** Segredos por loja (token, secret, cookie de sessão) isolados da
  configuração pública, com suporte a rotação.
- **Relacionamentos.** N:1 `Store`.
- **Chaves e índices.** PK `cuid`; único `(storeId, key, version)`.
- **Constraints.** `valueEncrypted` guarda ciphertext (AES-GCM, chave em variável
  de ambiente) — **nunca texto plano**. `SELECT * FROM stores` num terminal
  compartilhado não pode vazar credencial.
- **Atualização.** Versionada: rotacionar cria `version + 1` e marca a anterior com
  `rotatedAt`. Permite rollback se a credencial nova falhar.

### `Category`
- **Finalidade.** Taxonomia **interna** do BeautyBot (Skincare, Maquiagem…),
  hierárquica e independente das taxonomias de cada loja.
- **Relacionamentos.** Auto-relacionamento `parentId` (árvore); 1:N `Product`,
  `Offer`; N:N `TelegramChannel` via `ChannelCategory`; 1:N `StoreCategoryMap`.
- **Chaves e índices.** PK `cuid`; `slug` único; índices em `parentId`, `path` e
  `(isActive, sortOrder)`.
- **Constraints.** `path` é **materialized path** (`/beleza/skincare/protetor`) com
  `depth`. Consultar "toda a subárvore de Skincare" vira um `LIKE '/beleza/skincare/%'`
  usando índice — em vez de CTE recursiva a cada request.
- **Atualização.** Mutável. Mover um nó exige reescrever `path` da subárvore em
  transação (operação rara, feita manualmente).

### `StoreCategoryMap`
- **Finalidade.** Traduz a categoria da loja ("Beleza > Cuidados com a Pele > Facial",
  id `100234` na Shopee) para a categoria interna.
- **Relacionamentos.** N:1 `Store`, N:1 `Category`.
- **Chaves e índices.** PK `cuid`; único `(storeId, externalCategoryId)`.
- **Atualização.** Upsert pelo conector; `confidence` permite mapeamento sugerido
  por IA e revisado por humano depois.
- **Por que existe.** Sem essa tabela, a regra de tradução acabaria hard-coded em
  cada conector — e adicionar uma loja significaria editar código de negócio.

### `Brand`
- **Finalidade.** Marca do produto. Isolada porque a marca é um **sinal de qualidade
  reutilizável**: se "Contratipo Importado" gera reclamação, bloqueia-se uma linha
  e todos os produtos e ofertas futuros herdam a decisão.
- **Relacionamentos.** 1:N `Product`, `ProductGroup`, `Offer`.
- **Chaves e índices.** PK `cuid`; `slug` e `normalizedName` únicos; índice em
  `isBlocked`.
- **Constraints.** `normalizedName` = nome sem acento, minúsculo, sem pontuação —
  é o que impede "L'Oréal", "L Oreal" e "loreal" de virarem três marcas.
- **Atualização.** Upsert por `normalizedName` durante a ingestão.

### `ProductGroup`
- **Finalidade.** Agrupa o **mesmo produto vendido em lojas diferentes**. É a peça
  que habilita comparação de preço entre lojas — sem ela, "o menor preço do
  mercado" é impossível de responder.
- **Relacionamentos.** 1:N `Product`; N:1 `Brand`.
- **Chaves e índices.** PK `cuid`; `gtin` único (parcial, ignora nulos); índice em
  `(brandId, normalizedTitle)`.
- **Atualização.** Preenchido por processo de *matching* (GTIN quando existe;
  similaridade de título + marca como fallback). `matchConfidence` registra o quão
  confiável foi o agrupamento.
- **Nota.** Hoje pode ficar majoritariamente vazia. Está aqui porque adicionar esse
  agrupamento depois exigiria reprocessar todo o catálogo histórico.

### `Product`
- **Finalidade.** Um produto **em uma loja específica**. O mesmo batom na Amazon e
  na Shopee são duas linhas de `Product` apontando para um `ProductGroup`.
- **Relacionamentos.** N:1 `Store`, `Brand?`, `Category?`, `ProductGroup?`;
  1:N `ProductImage`, `PriceObservation`, `Offer`, `AffiliateLink`; N:N `Tag`.
- **Chaves e índices.**
  - PK `cuid`; **único `(storeId, externalId)`** — a chave natural, e a base da
    idempotência: reprocessar o mesmo lote nunca duplica produto.
  - Índice em `(storeId, lastSeenAt)` para detectar produtos sumidos.
  - Índice em `(categoryId, isActive)` para as buscas da interface.
  - Índice GIN em `normalizedTitle` (`pg_trgm`) para busca textual tolerante a erro.
- **Constraints.** `rating` entre 0 e 5; `reviewCount >= 0` (CHECK).
- **Atualização.** **Upsert por `(storeId, externalId)`** a cada varredura.
  `contentHash` (hash dos campos relevantes) evita `UPDATE` inútil quando nada
  mudou — em 50 mil produtos por ciclo, isso elimina a esmagadora maioria das
  escritas e mantém o autovacuum tranquilo. `lastSeenAt` é sempre atualizado.

### `ProductImage`
- **Finalidade.** Imagens do produto, ordenadas.
- **Relacionamentos.** N:1 `Product` (cascade delete).
- **Chaves e índices.** PK `cuid`; único `(productId, position)`; índice parcial em
  `isPrimary`.
- **Atualização.** Substituição em bloco por produto quando o `checksum` do conjunto
  muda. `localPath` está previsto para quando as imagens forem espelhadas em storage
  próprio (proteção contra hotlink bloqueado pela loja).

### `Tag` / `ProductTag`
- **Finalidade.** Classificação transversal que não cabe na hierarquia de categorias:
  "vegano", "importado", "kit", "black-friday", "curadoria-manual".
- **Relacionamentos.** N:N `Product` via tabela de junção **explícita**.
- **Chaves e índices.** `Tag.slug` único; `ProductTag` com PK composta
  `(productId, tagId)` e índice reverso em `tagId`.
- **Por que junção explícita.** A tabela implícita do Prisma (`_ProductToTag`) não
  aceita colunas extras. `ProductTag` carrega `source` (`MANUAL`, `AI`, `RULE`) e
  `createdAt` — necessário para distinguir tag humana de tag inferida.

---

## 5. Domínio: Precificação

O coração da defesa contra promoção falsa. Sem histórico próprio, o sistema depende
do "de/por" informado pela loja — exatamente o número que é inflado.

### `PriceObservation`
- **Finalidade.** Série temporal append-only: o preço de um produto num instante.
  É a **fonte da verdade** sobre o que é desconto real.
- **Relacionamentos.** N:1 `Product`, `Store`, `Execution?`.
- **Chaves e índices.**
  - PK `BigInt` sequencial.
  - **Índice `(productId, observedAt DESC)`** — o índice mais importante do banco.
    Serve tanto ao gráfico de histórico quanto ao cálculo de estatística.
  - Índice `(observedAt)` para a rotina de retenção.
- **Constraints.** `price > 0` (CHECK). Sem `updatedAt`: uma observação é um fato,
  fatos não se editam.
- **Atualização.** **Append-only, e só quando o preço muda.** Gravar 50 mil linhas
  idênticas a cada 15 minutos seria 4,8 bilhões de linhas por ano de puro ruído.
  Grava-se apenas na mudança (mais um "heartbeat" diário para provar continuidade),
  o que reduz o volume em mais de 95%.
- **Escala.** Preparada para `PARTITION BY RANGE (observedAt)` mensal. Prisma não
  declara particionamento; ele entra por SQL bruto na migration (§10). Retenção:
  partições com mais de 24 meses são agregadas em `PriceStatistic` e removidas com
  `DROP TABLE` — instantâneo, ao contrário de um `DELETE` de milhões de linhas.

### `PriceStatistic`
- **Finalidade.** Rollup por produto e janela (7/30/90/180 dias): mínimo, máximo,
  média, mediana, p25 e desvio-padrão.
- **Relacionamentos.** N:1 `Product`.
- **Chaves e índices.** PK `cuid`; único `(productId, windowDays)`.
- **Atualização.** **Recalculado, não incrementado**, por job noturno e sob demanda
  quando chega observação que quebra o mínimo histórico.
- **Por que materializar.** Validar uma oferta exige comparar o preço atual contra a
  distribuição histórica. Fazer isso com agregação sobre milhões de linhas, para
  cada uma das milhares de ofertas por ciclo, não escala. Aqui vira um lookup por
  chave única. **A mediana e o p25 importam mais que a média**: são resistentes a
  outliers, e é justamente de outlier que a promoção falsa é feita.

---

## 6. Domínio: Ofertas

### `Offer`
- **Finalidade.** Uma promoção detectada — a entidade central do produto. Note a
  distinção: `Product` é *o que existe*, `PriceObservation` é *o que foi visto*,
  `Offer` é *o que vale a pena contar a alguém*.
- **Relacionamentos.** N:1 `Product`, `Store`, `Category?`, `Brand?`, `Coupon?`,
  `Execution?`, `AffiliateLink?`; 1:N `OfferPrice`, `OfferStatusEvent`, `AiAnalysis`,
  `TelegramMessage`, `Click`, `Conversion`.
- **Chaves e índices.**
  - PK `cuid`; **`dedupeKey` único**.
  - `(status, detectedAt DESC)` — alimenta a fila da IA e a tela de Promoções.
  - `(productId, detectedAt DESC)` — "já anunciamos isso recentemente?".
  - `(categoryId, status)` e `(storeId, status)` para os filtros da interface.
  - `(score DESC)` parcial para `status = PENDING_REVIEW`, ordenando a fila.
- **Constraints.** `discountPercent` entre 0 e 100; `price > 0`;
  `price <= previousPrice` (CHECK).
- **Deduplicação.** `dedupeKey = sha256(productId | round(price,2) | date)` impede
  que o mesmo produto ao mesmo preço vire duas ofertas no mesmo dia — inclusive sob
  execuções concorrentes, porque a garantia é do banco (índice único), não da
  aplicação. Além disso, o índice `(productId, detectedAt)` sustenta a janela
  anti-repetição de 72 h.
- **Atualização.** Criada uma vez; depois só transita de estado. Toda transição
  grava uma linha em `OfferStatusEvent`. Campos `*At` (`validatedAt`, `publishedAt`,
  `ignoredAt`) são preenchidos uma única vez — dão o funil sem `JOIN`.

### `OfferPrice`
- **Finalidade.** O preço de uma oferta pode mudar **enquanto ela está viva** (a loja
  baixa mais, ou some com o desconto antes da publicação agendada). Esta tabela é a
  trilha dessas mudanças.
- **Relacionamentos.** N:1 `Offer` (cascade).
- **Chaves e índices.** PK `BigInt`; índice `(offerId, capturedAt DESC)`.
- **Atualização.** Append-only. Permite detectar "a promoção acabou antes de
  publicarmos" e cancelar o agendamento — um dos maiores geradores de perda de
  credibilidade num canal de ofertas.

### `OfferStatusEvent`
- **Finalidade.** Auditoria completa do ciclo de vida: `DETECTED → VALIDATED →
  PENDING_REVIEW → APPROVED → SCHEDULED → PUBLISHED`, ou `→ REJECTED / EXPIRED`.
- **Relacionamentos.** N:1 `Offer` (cascade).
- **Chaves e índices.** PK `BigInt`; índice `(offerId, createdAt)`;
  índice `(toStatus, createdAt)` para métricas de funil.
- **Constraints.** `actorType` enum (`SYSTEM`, `AI`, `USER`) + `actorId` opcional.
- **Atualização.** Append-only. É daqui que sai o tempo médio entre detecção e
  publicação — métrica que a Central exibe e que seria impossível reconstruir se o
  sistema apenas sobrescrevesse `Offer.status`.

### `Coupon`
- **Finalidade.** Cupons de desconto, com validade e regras de aplicação.
- **Relacionamentos.** N:1 `Store`; 1:N `Offer`.
- **Chaves e índices.** PK `cuid`; único `(storeId, code)`; índice
  `(storeId, isActive, expiresAt)`.
- **Constraints.** `type` enum (`PERCENT`, `FIXED`, `FREE_SHIPPING`, `CASHBACK`);
  `value >= 0`; CHECK garantindo `expiresAt > startsAt`.
- **Atualização.** Upsert por `(storeId, code)`. `isVerified` + `lastVerifiedAt`
  registram a última checagem de validade — publicar cupom morto é o erro mais
  visível para o público de um canal de ofertas.

---

## 7. Domínio: Monetização

### `AffiliateProgram`
- **Finalidade.** Configuração comercial por loja: rede, comissão base, duração do
  cookie de atribuição.
- **Relacionamentos.** N:1 `Store`; 1:N `AffiliateLink`.
- **Chaves e índices.** PK `cuid`; único `(storeId, network)`.
- **Atualização.** Manual, raríssima. `commissionRate` é o **fallback**; a comissão
  real vem em `Conversion.commission`, porque varia por categoria e por campanha.

### `AffiliateLink`
- **Finalidade.** A URL rastreável. Guarda a original e a versão com tag, além de um
  `shortSlug` próprio.
- **Relacionamentos.** N:1 `Store`, `AffiliateProgram?`, `Product?`, `Offer?`;
  1:N `Click`, `Conversion`, `TelegramMessage`.
- **Chaves e índices.** PK `cuid`; **`shortSlug` único**; índices em `offerId` e
  `(storeId, createdAt)`.
- **Por que redirecionador próprio.** Publicar `bb.link/x7Kp2` em vez da URL de
  afiliado dá três coisas que a URL direta não dá: (1) cliques rastreáveis mesmo
  quando a rede não reporta; (2) a possibilidade de trocar o destino depois da
  publicação — cupom expirado passa a apontar para a busca do produto em vez de uma
  página morta; (3) mensagem visualmente limpa.
- **Atualização.** Imutável, exceto `clickCount`/`conversionCount`/`revenue`
  (contadores) e `targetUrl` (redirecionamento corrigido).

### `Click`
- **Finalidade.** Cada clique no link rastreável.
- **Relacionamentos.** N:1 `AffiliateLink`, `Offer?`, `TelegramMessage?`,
  `TelegramChannel?`; 1:N `Conversion`.
- **Chaves e índices.** PK `BigInt`; índices `(affiliateLinkId, occurredAt)`,
  `(messageId, occurredAt)` e `(occurredAt)`.
- **Constraints.** **`ipHash`, nunca IP em claro** — SHA-256 com salt. Dá contagem
  de unicidade e detecção de abuso sem armazenar dado pessoal (LGPD).
  `isBot` marca tráfego automatizado sem descartá-lo.
- **Atualização.** Append-only, particionável por mês. Retenção sugerida: 12 meses
  no detalhe, agregados preservados indefinidamente em `DailyAnalytics`.

### `Conversion`
- **Finalidade.** Venda atribuída. Fecha o ciclo econômico.
- **Relacionamentos.** N:1 `Click?`, `AffiliateLink`, `Offer?`.
- **Chaves e índices.** PK `BigInt`; **único `(storeId, externalOrderId)`**;
  índices `(status, occurredAt)` e `(affiliateLinkId, occurredAt)`.
- **Constraints.** `status` enum (`PENDING`, `CONFIRMED`, `CANCELLED`, `REFUNDED`) —
  comissão de afiliado só é definitiva depois do prazo de devolução, às vezes 90
  dias. Modelar isso como booleano seria erro estrutural.
- **Atualização.** `INSERT` na notificação da rede; `UPDATE` do `status` na
  confirmação ou no estorno. O único caso do sistema em que uma linha "de evento"
  é mutável — e por isso `Conversion` é a exceção deliberada à regra do §1.1.
- **Idempotência.** `externalOrderId` único por loja: webhooks reenviam o mesmo
  pedido rotineiramente, e a garantia precisa ser do banco.

---

## 8. Domínio: Publicação

### `TelegramChannel`
- **Finalidade.** Canal de destino, com suas regras de publicação.
- **Relacionamentos.** N:N `Category` via `ChannelCategory`; 1:N `TelegramMessage`,
  `Click`.
- **Chaves e índices.** PK `cuid`; `chatId` (BigInt do Telegram) e `handle` únicos;
  índice em `isActive`.
- **Constraints.** `maxPostsPerHour` e a janela `postingWindowStart/End` são
  **regras de negócio no banco**, não constantes no código — mudam sem deploy.
- **Atualização.** Configuração manual; `memberCount` sincronizado periodicamente.

### `ChannelCategory`
- **Finalidade.** Roteamento: qual categoria vai para qual canal.
- **Chaves e índices.** PK composta `(channelId, categoryId)`; índice reverso.
- **Constraints.** `weight` permite priorizar categorias dentro de um canal quando
  há mais ofertas do que slots disponíveis.

### `MessageTemplate`
- **Finalidade.** Modelo da mensagem, versionado.
- **Relacionamentos.** 1:N `TelegramMessage`, `TelegramChannel`.
- **Chaves e índices.** PK `cuid`; único `(slug, version)`.
- **Atualização.** **Imutável por versão.** Editar cria `version + 1`. Assim, uma
  mensagem enviada há seis meses sempre aponta para o template exato que a gerou —
  e um teste A/B de formato vira comparação entre `templateId`s.

### `TelegramMessage`
- **Finalidade.** Uma publicação: agendada, enviada, falha ou removida.
- **Relacionamentos.** N:1 `Offer?`, `TelegramChannel`, `MessageTemplate?`,
  `AffiliateLink?`; 1:N `MessageAttempt`, `Click`.
- **Chaves e índices.**
  - PK `cuid`; único `(channelId, externalMessageId)`.
  - **`(status, scheduledFor)`** — a query do worker de publicação, executada
    continuamente.
  - `(channelId, sentAt DESC)` para a tela de Enviadas.
  - Único parcial `(offerId, channelId)` para `status IN (SENT, SCHEDULED)`:
    o banco impede publicar a mesma oferta duas vezes no mesmo canal.
- **Constraints.** `renderedText` é **snapshot do texto final** enviado. Se o
  template mudar, o histórico permanece fiel ao que o público viu.
- **Atualização.** Transiciona de estado; contadores de clique/conversão/receita
  incrementados por gatilho da aplicação.

### `MessageAttempt`
- **Finalidade.** Cada tentativa de entrega, com erro e latência.
- **Relacionamentos.** N:1 `TelegramMessage` (cascade).
- **Chaves e índices.** PK `BigInt`; único `(messageId, attemptNo)`.
- **Atualização.** Append-only. Separar tentativa de mensagem é o que permite
  política de retry com backoff sem perder o rastro das falhas — a API do Telegram
  aplica rate limit agressivo e `429` é rotina, não exceção.

---

## 9. Domínio: Inteligência

### `AiModel` e `AiPrompt`
- **Finalidade.** Versionar **o que decidiu** e **com quais instruções**.
- **Chaves e índices.** `AiModel.key` único; `AiPrompt` único `(key, version)`.
- **Constraints.** Custos por 1k tokens ficam no modelo, permitindo calcular gasto
  sem consultar tabela de preços externa.
- **Atualização.** Imutáveis por versão; troca de modelo é nova linha + `isActive`.
- **Por que existe.** Sem isso, "a precisão caiu na semana passada" é impossível de
  investigar. Com isso, é um `GROUP BY modelId` — e comparar duas versões de prompt
  vira uma query, não uma reconstrução arqueológica de logs.

### `AiAnalysis`
- **Finalidade.** Uma decisão da IA sobre uma oferta: score, veredicto, motivos,
  custo e latência.
- **Relacionamentos.** N:1 `Offer` (cascade), `AiModel`, `AiPrompt?`;
  1:N `AiFeedback`.
- **Chaves e índices.** PK `cuid`; índices `(offerId, createdAt DESC)`,
  `(modelId, createdAt)` e `(verdict, createdAt)`.
- **Constraints.** `score` entre 0 e 100; `confidence` entre 0 e 1.
  `rejectionReason` é enum — é o que faz o gráfico "motivos de rejeição" ser uma
  agregação indexada em vez de parsing de texto livre.
- **Atualização.** Append-only. Reavaliar uma oferta cria **nova análise**, nunca
  sobrescreve. `rawResponse` em `Jsonb` guarda a resposta íntegra do modelo, para
  depuração e futura reavaliação offline.

### `AiFeedback`
- **Finalidade.** O veredicto humano sobre a decisão da IA. É o **dado mais valioso
  do sistema** a longo prazo.
- **Relacionamentos.** N:1 `AiAnalysis` (cascade), `User?`.
- **Chaves e índices.** PK `cuid`; índices `(analysisId)` e `(agreed, createdAt)`.
- **Atualização.** Append-only.
- **Por que importa.** Cada vez que o operador clica "Publicar" ou "Ignorar" numa
  oferta que a IA classificou, gera-se um par (previsão, verdade). Em um ano isso é
  um conjunto de treino proprietário — a métrica "precisão" da tela de IA sai
  daqui, e nada disso existe se o clique não for persistido.

### `AiSuggestion`
- **Finalidade.** Recomendações de otimização geradas pela IA ("elevar o desconto
  mínimo de Maquiagem para 45%").
- **Relacionamentos.** N:1 `User?` (quem aplicou).
- **Chaves e índices.** PK `cuid`; índice `(status, createdAt DESC)`.
- **Constraints.** `payload` em `Jsonb` descreve a mudança de forma estruturada,
  permitindo que "Aplicar" seja uma ação executável, não uma instrução para o
  humano refazer à mão.
- **Atualização.** `status` transita `NEW → APPLIED | DISMISSED | EXPIRED`.

---

## 10. Domínio: Orquestração

### `SchedulerJob`
- **Finalidade.** Definição do que roda, quando e com quais limites.
- **Relacionamentos.** N:1 `Store?`; 1:N `Execution`.
- **Chaves e índices.** PK `cuid`; `key` único; índice `(isEnabled, nextRunAt)`.
- **Constraints.** `cronExpression` + `timezone`; `timeoutSeconds`,
  `concurrencyLimit` e `maxRetries` como colunas, não constantes de código.
- **Atualização.** `nextRunAt`/`lastRunAt` a cada disparo.

### `Execution`
- **Finalidade.** Uma execução concreta, com métricas agregadas do que produziu.
- **Relacionamentos.** N:1 `SchedulerJob?`, `Store?`; auto-relacionamento
  `parentExecutionId`; 1:N `ExecutionStep`, `Log`, `Offer`, `PriceObservation`.
- **Chaves e índices.** PK `cuid`; índices `(jobId, startedAt DESC)`,
  `(storeId, startedAt DESC)` e `(status, startedAt)`.
- **Constraints.** `status` inclui `PARTIAL` — o caso realista em que 4 de 5 lojas
  responderam. Reduzir isso a sucesso/fracasso perde informação operacional.
- **Atualização.** `INSERT` ao iniciar; `UPDATE` único ao terminar (`finishedAt`,
  `durationMs`, contadores). A execução-pai agrega as filhas por loja.

### `ExecutionStep`
- **Finalidade.** Granularidade dentro da execução: autenticar, buscar página 1..n,
  normalizar, deduplicar, avaliar, publicar.
- **Chaves e índices.** PK `cuid`; único `(executionId, sequence)`.
- **Atualização.** Append + um `UPDATE` de encerramento. É o que transforma "a
  execução demorou 8 s" em "a paginação demorou 6,2 s dos 8 s" — sem isso,
  otimizar conector é adivinhação.

### `QueueJob`
- **Finalidade.** Fila durável no próprio Postgres.
- **Chaves e índices.** PK `BigInt`; **índice `(queue, status, availableAt, priority)`**,
  que sustenta o `SELECT ... FOR UPDATE SKIP LOCKED` do worker.
- **Constraints.** `attempts < maxAttempts`; `lockedBy` + `lockedAt` para detectar
  worker morto e liberar o job.
- **Atualização.** Mutável e de alta rotatividade. **Requer autovacuum agressivo**
  (`autovacuum_vacuum_scale_factor = 0.01`), definido na migration.
- **Decisão.** Postgres em vez de Redis/BullMQ: para um único operador, um serviço a
  menos vale mais que a vazão extra. `SKIP LOCKED` entrega semântica de fila
  correta, e o job fica na **mesma transação** que a mudança de dados — o problema
  clássico de "gravei a oferta mas perdi o job de publicar" simplesmente não existe.
  Se o volume justificar, migrar é trocar a implementação do worker; o schema não
  muda.

---

## 11. Domínio: Observabilidade e Configuração

### `Log`
- **Finalidade.** Log estruturado de tudo que o motor executa.
- **Relacionamentos.** N:1 `Execution?`, `Store?`, `Offer?`.
- **Chaves e índices.** PK `BigInt`; índices `(createdAt DESC)`,
  `(level, createdAt DESC)`, `(source, createdAt DESC)`, `(correlationId)`;
  GIN em `context` (via SQL bruto).
- **Constraints.** `context` em `Jsonb` — estruturado e consultável, não string
  concatenada. `correlationId` amarra todos os eventos de uma mesma execução.
- **Atualização.** Append-only, particionado por mês, retenção de 14 dias para
  `DEBUG` e 90 dias para os demais níveis.

### `MetricSample`
- **Finalidade.** Série temporal genérica de métricas (`connector.latency_ms`,
  `ai.cost_usd`, `queue.depth`).
- **Chaves e índices.** PK `BigInt`; único
  `(name, granularity, bucketStart, dimensionsHash)`; índice
  `(name, bucketStart DESC)`.
- **Constraints.** `dimensions` em `Jsonb` + `dimensionsHash` — o hash existe porque
  o Postgres não indexa `jsonb` em índice único de forma prática.
- **Atualização.** Upsert pela chave única (agregação incremental dentro do bucket).
- **Decisão.** Uma tabela genérica em vez de uma coluna por métrica: adicionar uma
  métrica nova nunca deve exigir migration. Granularidade em cascata
  (`MINUTE → HOUR → DAY`) com retenção decrescente é o padrão de qualquer TSDB.

### `DailyAnalytics`
- **Finalidade.** Rollup diário de negócio, recortado por loja, categoria e canal.
- **Chaves e índices.** PK `cuid`; **único `(date, dimensionKey)`**; índices
  `(date DESC)` e `(storeId, date DESC)`.
- **Atenção.** As três FKs de recorte são nulas (uma linha pode ser "o dia
  inteiro, todas as lojas"). Um índice único sobre colunas nulas **não impede
  duplicatas no Postgres**, porque `NULL != NULL`. Por isso a unicidade recai
  sobre `dimensionKey` (`"storeId:categoryId:channelId"`, com `*` no lugar do
  nulo), enquanto as FKs continuam existindo para o `JOIN`.
- **Atualização.** Recalculado pelo job noturno para os últimos 7 dias — janela que
  cobre conversões confirmadas com atraso pela rede de afiliados.
- **Por que existe.** A tela de Analytics precisa de 30 dias em milissegundos.
  Agregar cliques e conversões brutos a cada abertura não sobrevive ao ano 2.

### `Setting` e `SettingHistory`
- **Finalidade.** Configuração em runtime, com escopo hierárquico
  (`GLOBAL → STORE → CATEGORY → CHANNEL`) e trilha de alterações.
- **Chaves e índices.** único `(key, scope, scopeId)`; índice em `key`.
  `scopeId` é **não-nulo com default `""`** (string vazia = `GLOBAL`) — pela mesma
  razão descrita em `DailyAnalytics`: com `NULL`, duas configurações globais de
  mesma chave passariam pelo índice único sem erro.
- **Constraints.** `value` em `Jsonb` com `valueType` declarado, permitindo validação
  por schema na aplicação. `isSecret` esconde o valor na interface.
- **Atualização.** Upsert; **toda escrita gera linha em `SettingHistory`**. Rollback
  de configuração é uma leitura, não uma tentativa de lembrar o valor anterior.
- **Resolução.** O valor efetivo é o do escopo mais específico que existir; a
  ausência de linha significa "herda do escopo acima".

### `FeatureFlag`
- **Finalidade.** Ligar e desligar comportamento sem deploy — essencial num sistema
  que roda sozinho e onde um conector novo precisa de desligamento imediato.

### `Notification`
- **Finalidade.** Alertas para o operador (conector caído, cota perto do limite,
  queda anômala de conversão).
- **Chaves e índices.** PK `cuid`; índice `(isRead, createdAt DESC)` e
  `(severity, createdAt DESC)`.
- **Constraints.** `dedupeKey` opcional e único evita 200 alertas idênticos durante
  uma indisponibilidade prolongada.

### `Task`
- **Finalidade.** Trabalho que exige um humano: revisar mapeamento de categoria,
  verificar cupom, corrigir seletor de scraper quebrado.
- **Relacionamentos.** N:1 `User?`, `Offer?`, `Store?`.
- **Chaves e índices.** PK `cuid`; índice `(status, priority, dueAt)`.

---

## 12. O que Prisma não expressa (e entra por SQL bruto)

O Prisma cobre ~90% do necessário. Os 10% restantes são justamente as partes que
sustentam a escala, e vão em migrations manuais:

```sql
-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- busca textual tolerante a erro
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 2. CHECK constraints (Prisma não declara)
ALTER TABLE offers            ADD CONSTRAINT ck_offers_discount
  CHECK (discount_percent >= 0 AND discount_percent <= 100);
ALTER TABLE offers            ADD CONSTRAINT ck_offers_price
  CHECK (price > 0 AND price <= previous_price);
ALTER TABLE price_observations ADD CONSTRAINT ck_price_positive
  CHECK (price > 0);
ALTER TABLE products          ADD CONSTRAINT ck_products_rating
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));
ALTER TABLE ai_analyses       ADD CONSTRAINT ck_ai_score
  CHECK (score >= 0 AND score <= 100);

-- 3. Índices parciais (economizam espaço indexando só o que se consulta)
CREATE UNIQUE INDEX uq_message_offer_channel_live
  ON telegram_messages (offer_id, channel_id)
  WHERE status IN ('SCHEDULED', 'SENT');

CREATE INDEX ix_offers_review_queue
  ON offers (score DESC, detected_at DESC)
  WHERE status = 'PENDING_REVIEW';

CREATE UNIQUE INDEX uq_product_group_gtin
  ON product_groups (gtin) WHERE gtin IS NOT NULL;

-- 4. Índices GIN
CREATE INDEX ix_products_title_trgm
  ON products USING gin (normalized_title gin_trgm_ops);
CREATE INDEX ix_logs_context_gin
  ON logs USING gin (context jsonb_path_ops);

-- 5. Particionamento das tabelas de evento (a partir do 1º milhão de linhas)
--    price_observations, clicks, logs → PARTITION BY RANGE (observed_at | created_at)
--    com criação automática da partição do mês seguinte via pg_cron.

-- 6. Autovacuum agressivo na fila
ALTER TABLE queue_jobs SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.01
);
```

## 13. Plano de crescimento

| Fase | Volume | Ação |
| --- | --- | --- |
| **0–6 meses** | < 5 M linhas | Instância única. Índices do schema bastam. |
| **6–18 meses** | 50–200 M | Particionar `price_observations`, `logs` e `clicks` por mês. Ativar retenção. |
| **18–36 meses** | 500 M+ | Réplica de leitura para Analytics. `DailyAnalytics` vira materialized view com refresh concorrente. |
| **36 meses+** | 1 B+ | Avaliar TimescaleDB para as séries temporais (compressão de 10–20× e agregação contínua), mantendo o núcleo OLTP em Postgres puro. |

Nada nessa progressão exige remodelagem: as decisões do §1 são precisamente o que
permite adiar cada etapa até que ela seja necessária — e executá-la sem reescrever
a aplicação.
