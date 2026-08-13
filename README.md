# BeautyBot — Central de Operações

Ferramenta interna de uso pessoal. Sem login, sem landing page, sem telas comerciais:
a raiz `/` **é** a Central de Operações.

```bash
cp .env.example .env   # ajuste DATABASE_URL antes de tudo
npm run dev            # servidor web  → http://localhost:3000
npm run worker         # runtime de background (scheduler + filas)
npm run typecheck      # tsc --noEmit
npm run build
```

São **dois processos**: o web serve interface e API; o worker executa scheduler
e filas. A infraestrutura do backend está documentada em
[docs/BACKEND.md](docs/BACKEND.md).

## Banco de dados

PostgreSQL 16 + Prisma 7. A modelagem completa (45 tabelas, decisão a decisão)
está em [docs/DATABASE.md](docs/DATABASE.md).

```bash
cp .env.example .env      # ajuste DATABASE_URL
npm run db:migrate        # cria as tabelas
npm run db:sql            # CHECKs, índices parciais e GIN (o que o Prisma não expressa)
npm run db:seed           # configuração de base: lojas, categorias, canais, jobs, settings
npm run db:studio         # inspeção visual
```

O seed traz **apenas configuração** — nenhum produto, oferta ou métrica fictícia.
Semear dados de operação inventados contaminaria o histórico de preços, que é
justamente a defesa do sistema contra promoção falsa.

## Stack

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Roteamento por pastas, RSC e um único processo para futura API interna |
| UI | React 19 + TypeScript | Contrato de tipos entre dados e componentes |
| Estilo | Tailwind CSS v4 (`@theme`) | Tokens de design em CSS puro, sem `tailwind.config.js` |
| Animação | Framer Motion | Layout animations e transições de entrada/saída |
| Gráficos | Recharts | Composição declarativa, fácil de tematizar |
| Ícones | Lucide | Traço fino consistente com a tipografia |
| Dados | React Query | Já provisionado para quando o backend real existir |

## Estrutura

```
src/
  app/                     # uma pasta por rota, todas dentro do shell fixo
    layout.tsx             # Sidebar + Header + Providers
    providers.tsx          # QueryClientProvider
    globals.css            # tokens de design e utilitários compostos
    page.tsx               # Central de Operações
    promocoes/  enviadas/  agendadas/  lojas/
    categorias/ ia/        analytics/  logs/  configuracoes/
  components/
    layout/                # sidebar, header, page-shell (título + stagger)
    ui/                    # primitivos: card, button, badge, controls
    charts/                # AreaTrend, Bars, Donut, Sparkline + tooltip único
    dashboard/             # kpi-card, activity-stream, ai-queue
    deals/                 # thumb, deal-table (busca, filtros, ordenação)
  data/                    # dados de demonstração determinísticos
  lib/utils.ts             # cn + formatação pt-BR (moeda, %, datas relativas)
  types/                   # Deal, Store, Category, LogEntry, TelegramChannel
```

### Decisões que sustentam a evolução

- **Âncora temporal fixa** (`NOW` em `src/data/stores.ts`). Todos os timestamps são
  derivados dela, então servidor e cliente renderizam idêntico — zero risco de
  divergência de hidratação. Ao plugar o backend, basta trocar a origem dos dados.
- **Sem imagens externas.** As miniaturas de produto são "pack shots" sintéticos
  (gradiente + iniciais da marca), o que elimina estados de imagem quebrada e mantém
  a grade visualmente homogênea.
- **Gráficos genéricos.** `AreaTrend`/`Bars` são genéricos em `T`, aceitam qualquer
  série tipada e compartilham um único tooltip — a identidade visual não se dispersa.
- **Conector como unidade.** A tela de Lojas trata cada integração como um plugin
  isolado (`StoreConnector`); adicionar Amazon/Shopee/ML é acrescentar um card, não
  reescrever a página.

### Design system

Todos os tokens vivem no bloco `@theme` de `globals.css`: superfícies (`base`,
`surface`, `elevated`), traços (`line`, `line-strong`), texto (`fg`, `fg-muted`,
`fg-subtle`), acentos (violeta, rosa, azul elétrico, ciano) e semânticos
(`ok`, `warn`, `danger`). Nada de cor solta em componente — mudar a paleta inteira
é editar um arquivo.

## Estado atual

As dez telas estão implementadas e navegáveis, com dados de demonstração realistas.
Interações já funcionais: decisão na fila da IA (publicar/agendar/ignorar com saída
animada), busca e filtros combinados em Promoções, filtro por canal em Enviadas,
filtros + histograma + expansão de payload JSON em Logs, e toggles de categoria e
limiar de desconto em Configurações.

Próximo passo natural: substituir `src/data/*` por rotas `app/api/*` consumidas via
React Query, mantendo os mesmos tipos de `src/types`.
