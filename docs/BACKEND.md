# BeautyBot — Infraestrutura do backend

Base sobre a qual os módulos de negócio serão construídos. **Nenhuma regra de
negócio, scraping, IA ou integração externa existe aqui** — apenas o esqueleto
que os receberá.

---

## 1. Dois processos, um código

```
npm run dev      → servidor web  (Next.js: interface + API REST)
npm run worker   → runtime de background (scheduler + workers de fila)
```

A separação não é preciosismo. O ciclo de vida de um servidor Next.js pertence
ao framework: ele recria módulos a cada hot reload e, em ambientes serverless,
nem mantém processo vivo entre requisições. Scheduler e workers precisam do
oposto — processo longo, previsível, com shutdown controlado.

Consequência prática: escalar o trabalho de background é subir mais instâncias
do worker, sem tocar no servidor web. A fila no Postgres já garante que dois
workers nunca peguem o mesmo job.

## 2. Estrutura

```
src/server/
  config/
    env.ts              validação da configuração via Zod; falha no boot
    load-env.ts         carrega .env em processos fora do Next (worker, CLI)
  core/
    errors.ts           hierarquia AppError + normalizeError
    logger.ts           logger central (stdout + sink opcional no banco)
    context.ts          AsyncLocalStorage: correlationId implícito
  db.ts                 cliente Prisma compartilhado + pingDatabase
  repositories/         única camada que conhece o Prisma
  services/             orquestração; fala com repositories
  providers/
    types.ts            contrato StoreConnector
    registry.ts         registro explícito de conectores
    mock/               conector de referência (sem rede)
  queue/
    types.ts            filas nomeadas, tipos de handler
    handlers.ts         registro de handlers + noop/fail de infraestrutura
    queue.service.ts    enqueue/stats
    worker.ts           consumo com SKIP LOCKED, backoff, shutdown gracioso
  scheduler/
    cron.ts             próximas execuções, com timezone explícito
    scheduler.ts        tick → reivindica job → enfileira handler
  http/
    handler.ts          withApiHandler: erros, correlação, validação
    responses.ts        envelope único de resposta
  runtime/main.ts       entrypoint do processo de background
  bootstrap.ts          inicialização idempotente + shutdown

src/app/api/            rotas REST (thin: só validam e chamam services)
```

**Regra de dependência:** rota → service → repository → Prisma. Nunca ao
contrário, e nunca pulando etapas. Uma rota que importa `db` diretamente é um
bug de arquitetura, não um atalho.

## 3. API

Toda resposta usa o mesmo envelope, e todas carregam `correlationId` — o mesmo
que aparece na tabela `logs`.

```jsonc
{ "success": true,  "data": …,  "meta": { "correlationId": "…", "timestamp": "…" } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "…" }, "meta": { … } }
```

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/health` | Diagnóstico completo (503 só se essencial cair) |
| GET | `/api/health/live` | Liveness — **não** toca no banco |
| GET | `/api/health/ready` | Readiness — depende do banco |
| GET/POST | `/api/v1/stores` | Listar / criar loja |
| GET/PATCH/DELETE | `/api/v1/stores/[id]` | Detalhe / atualizar / desativar |
| POST | `/api/v1/stores/[id]/health` | Roda o healthCheck do conector e persiste |
| GET/PUT | `/api/v1/settings` | Ler / gravar configuração (com histórico) |
| GET/POST | `/api/v1/queue` | Estatísticas / enfileirar job |
| GET/POST | `/api/v1/scheduler` | Jobs / disparo manual, enable, tick |
| GET | `/api/v1/executions` | Histórico de execuções |
| GET | `/api/v1/logs` | Consulta de logs |
| GET | `/api/v1/providers` | Conectores registrados |

Rotas inexistentes sob `/api` devolvem **JSON**, não a página HTML do Next.

## 4. Decisões que valem conhecer

**Erros carregam `retryable`.** A fila usa esse campo para decidir entre
reenfileirar e mandar para a DLQ. Reprocessar 3× um payload inválido é
desperdício; não reprocessar um timeout de rede é perda de dado.

**O health check tem três estados.** `degraded` descreve a realidade da maioria
dos incidentes: o sistema atende, mas algo não essencial está ruim. Colapsar
isso em up/down faz o alarme disparar tarde demais ou o tempo todo.

**A aplicação sobe sem o banco.** Recusar-se a iniciar porque o Postgres ainda
não subiu transforma uma indisponibilidade curta numa manual. O health check
reporta o estado e o sistema continua tentando.

**Backoff tem jitter.** Sem ele, todos os jobs que falharam juntos voltariam
juntos e derrubariam o parceiro de novo.

**O scheduler não executa trabalho.** Ele só enfileira. Um job pesado rodando
dentro do tick atrasaria todos os outros — e o scheduler perderia a noção de
tempo justamente sob carga.

**Log de falha repetida é suprimido.** Com o banco fora, cinco workers gerando
um stack trace por poll produziram 1.301 linhas em 36 segundos durante os
testes. Hoje são 268, com recuo progressivo até 1 min — o log que deveria
explicar o incidente não pode ser o que impede de enxergá-lo.

## 5. Como adicionar um módulo

Adicionar um conector de loja (Shopee, Amazon, ML):

1. `src/server/providers/shopee/shopee.provider.ts` implementando `StoreConnector`.
2. Registrar em `registerProviders()` no [bootstrap](../src/server/bootstrap.ts).
3. Cadastrar a loja com `connectorKey` igual ao `key` do conector.

Adicionar trabalho agendado:

1. Criar o handler e registrá-lo em `registerHandlers()`.
2. Ligar o `JobType` ao handler com `mapJobTypeToHandler(...)`.
3. Cadastrar o `SchedulerJob` com a expressão cron (o seed já traz os oito
   jobs previstos, todos sem handler por enquanto).

Nenhum desses passos exige alterar scheduler, fila, logger ou API.

## 6. Estado verificado

| Verificação | Resultado |
| --- | --- |
| `tsc --noEmit` | limpo |
| `prisma validate` / `generate` | schema válido, client gerado |
| Servidor web + 10 telas | 200 |
| `/api/health/live` sem banco | 200 (correto: não depende do banco) |
| `/api/health` sem banco | 503 com o check `database: unhealthy` |
| Validação de payload inválido | 422 com erro campo a campo |
| Handler inexistente na fila | 404 estruturado |
| Rota `/api` inexistente | 404 em JSON |
| Runtime de background | sobe scheduler + 5 workers e **sobrevive** ao banco fora |

**Ainda não verificado:** tudo que exige um PostgreSQL de pé — `migrate`,
`seed`, e o caminho completo de um job (enqueue → dequeue → conclusão). Não há
Postgres nem Docker nesta máquina.
