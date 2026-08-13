import type { IntegrationType } from "@prisma/client";

/**
 * Catálogo de conectores disponíveis.
 *
 * Esta é a fonte única que descreve **quais lojas o sistema sabe integrar e
 * quais credenciais cada uma exige**. A interface de "Adicionar conector"
 * renderiza o formulário a partir daqui — nenhum campo é escrito à mão no
 * front-end.
 *
 * Consequência: acrescentar uma loja nova é acrescentar uma entrada neste
 * arquivo mais a classe do conector. O formulário, a validação e a tela de
 * seleção passam a existir sozinhos.
 */

export type CredentialFieldType = "text" | "password" | "select";

export interface CredentialField {
  /** Chave gravada em `store_credentials.key`. */
  id: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  /** Valor sensível: criptografado e nunca devolvido pela API. */
  secret: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  pattern?: string;
}

export type ConnectorStatus = "disponivel" | "experimental" | "planejado";

/**
 * `keys`  — as chaves bastam; o teste já valida tudo.
 * `oauth` — além das chaves, é preciso autorizar a aplicação na conta da loja
 *           num navegador. É o caso do Mercado Livre: o token de aplicação não
 *           dá acesso ao catálogo.
 */
export type AuthFlow = "keys" | "oauth";

export interface ConnectorDefinition {
  /** Igual ao `key` do `StoreConnector` e ao `Store.connectorKey`. */
  key: string;
  storeName: string;
  storeSlug: string;
  shortLabel: string;
  accentColor: string;
  integrationType: IntegrationType;
  status: ConnectorStatus;
  authFlow: AuthFlow;
  description: string;
  /** O que o operador precisa fazer antes de ter as chaves em mãos. */
  setupSteps: string[];
  docsUrl?: string;
  credentialFields: CredentialField[];
  /** Aviso honesto sobre o nível de verificação do conector. */
  verificationNote?: string;
}

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  // -------------------------------------------------------------------------
  {
    key: "mercadolivre-v1",
    storeName: "Mercado Livre",
    storeSlug: "mercado-livre",
    shortLabel: "ML",
    accentColor: "#facc15",
    integrationType: "OFFICIAL_API",
    status: "disponivel",
    authFlow: "oauth",
    description:
      "API oficial do Mercado Livre. Exige autorizar a aplicação na sua conta — o token de aplicação sozinho não acessa o catálogo.",
    setupSteps: [
      "Acesse developers.mercadolivre.com.br e faça login.",
      'Em "Suas integrações", crie (ou abra) a sua aplicação.',
      "Copie o Client ID (App ID) e o Client Secret nos campos abaixo.",
      'Cadastre a URL de redirect mostrada abaixo no campo "URI de redirect" da aplicação e salve.',
      'Clique em "Autorizar no Mercado Livre" e confirme o acesso na sua conta.',
    ],
    docsUrl: "https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao",
    credentialFields: [
      {
        id: "client_id",
        label: "Client ID (App ID)",
        type: "text",
        required: true,
        secret: false,
        placeholder: "1234567890123456",
        help: "Número da aplicação criada no painel de desenvolvedores.",
      },
      {
        id: "client_secret",
        label: "Client Secret",
        type: "password",
        required: true,
        secret: true,
        placeholder: "••••••••••••••••••••",
        help: "Gerado junto com a aplicação. Fica criptografado no banco.",
      },
      {
        id: "site_id",
        label: "Site",
        type: "select",
        required: true,
        secret: false,
        options: [
          { value: "MLB", label: "Brasil (MLB)" },
          { value: "MLA", label: "Argentina (MLA)" },
          { value: "MLM", label: "México (MLM)" },
        ],
        help: "Marketplace consultado nas buscas.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    key: "shopee-affiliate-v1",
    storeName: "Shopee Brasil",
    storeSlug: "shopee",
    shortLabel: "SP",
    accentColor: "#f97316",
    integrationType: "AFFILIATE_API",
    status: "experimental",
    authFlow: "keys",
    description:
      "API do Programa de Afiliados da Shopee. Autentica por assinatura SHA-256 a cada requisição.",
    setupSteps: [
      "Acesse affiliate.shopee.com.br e entre com sua conta de afiliado.",
      "Vá em Open API / API Management.",
      "Gere o App ID e a App Secret.",
      "Cole os dois campos abaixo e teste a conexão.",
    ],
    docsUrl: "https://open-api.affiliate.shopee.com.br/",
    verificationNote:
      "Implementado conforme a documentação, mas ainda não exercitado contra credenciais reais.",
    credentialFields: [
      {
        id: "app_id",
        label: "App ID",
        type: "text",
        required: true,
        secret: false,
        placeholder: "18300000000",
      },
      {
        id: "app_secret",
        label: "App Secret",
        type: "password",
        required: true,
        secret: true,
        placeholder: "••••••••••••••••••••",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    key: "amazon-paapi5",
    storeName: "Amazon Brasil",
    storeSlug: "amazon",
    shortLabel: "AZ",
    accentColor: "#fbbf24",
    integrationType: "OFFICIAL_API",
    status: "planejado",
    authFlow: "keys",
    description:
      "Product Advertising API 5.0. Exige assinatura AWS SigV4 e conta de Associado aprovada com vendas.",
    setupSteps: [
      "Tenha uma conta aprovada no Amazon Associates (exige vendas recentes).",
      "Em Ferramentas › Product Advertising API, solicite as credenciais.",
      "Copie Access Key, Secret Key e a sua Partner Tag.",
    ],
    docsUrl: "https://webservices.amazon.com/paapi5/documentation/",
    verificationNote:
      "Campos definidos, conector ainda não implementado — a assinatura SigV4 será feita numa etapa própria.",
    credentialFields: [
      { id: "access_key", label: "Access Key", type: "text", required: true, secret: false },
      { id: "secret_key", label: "Secret Key", type: "password", required: true, secret: true },
      {
        id: "partner_tag",
        label: "Partner Tag",
        type: "text",
        required: true,
        secret: false,
        placeholder: "seusite-20",
      },
      {
        id: "region",
        label: "Região",
        type: "select",
        required: true,
        secret: false,
        options: [
          { value: "us-east-1", label: "Brasil / EUA (us-east-1)" },
          { value: "eu-west-1", label: "Europa (eu-west-1)" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    key: "mock-connector-v1",
    storeName: "Conector de referência",
    storeSlug: "referencia",
    shortLabel: "RF",
    accentColor: "#8b5cf6",
    integrationType: "MANUAL",
    status: "disponivel",
    authFlow: "keys",
    description:
      "Não acessa rede. Gera produtos determinísticos para exercitar o pipeline sem depender de parceiro externo.",
    setupSteps: ["Não exige credenciais — basta adicionar."],
    credentialFields: [],
  },
];

export function findConnectorDefinition(key: string): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find((c) => c.key === key);
}

/** Só os conectores que podem ser efetivamente adicionados hoje. */
export function installableConnectors(): ConnectorDefinition[] {
  return CONNECTOR_CATALOG.filter((c) => c.status !== "planejado");
}
