# BeautyBot — Conectores de loja

Como adicionar uma loja pela interface, e como acrescentar uma loja nova ao
catálogo.

---

## 1. Pela interface

**Lojas → Adicionar conector.**

1. Escolha a loja. O catálogo vem do servidor; lojas ainda não implementadas
   aparecem como "em breve" e não podem ser selecionadas.
2. Preencha as chaves. O formulário é **gerado a partir do catálogo** — cada
   campo traz rótulo, ajuda e tipo corretos, e os segredos ficam mascarados
   com um botão de revelar.
3. **Testar conexão.** O sistema fala com a loja de verdade e mostra o
   resultado. Nada é gravado nesta etapa.
4. **Instalar conector.** Só libera depois de um teste bem-sucedido.

O passo 3 é o ponto central do desenho: **credencial errada nunca chega ao
banco**. E, como o teste não depende do Postgres, ele funciona mesmo com o
banco fora — dá para validar chaves antes de ter infraestrutura de pé.

Ao instalar, o sistema cria a `Store` e grava cada `StoreCredential` numa
única transação. Meia instalação — loja sem credencial — seria pior que
instalação nenhuma.

## 1.1. Mercado Livre: por que exige autorização

O token de aplicação (`client_credentials`) **não dá acesso ao catálogo**. A ML
restringiu `/sites/{site}/search`: com chaves perfeitamente válidas, a resposta
é 403. Foi exatamente o que apareceu no primeiro teste real.

Por isso a ML usa `authFlow: "oauth"`. O fluxo:

1. Você informa Client ID e Secret.
2. Copia a **URL de redirect** exibida e cadastra na sua aplicação, no painel
   da ML (campo "URI de redirect"). Precisa bater caractere por caractere.
3. Clica em "Autorizar no Mercado Livre" e confirma o acesso na sua conta.
4. A ML devolve o navegador ao callback, que troca o código por um token de
   usuário e **instala a loja**. Não há botão "Instalar" nesse fluxo.

O fluxo usa **PKCE (S256)**. Não é capricho: o `code` que volta trafega na
barra de endereços, e sem o verifier ele bastaria para outra pessoa obter um
token.

**Atenção ao refresh token.** A ML o invalida a cada uso e emite outro. O
conector devolve o novo pela função `onCredentialsUpdated` do contexto — sem
isso, a integração funcionaria hoje e morreria na renovação seguinte, sem nada
indicando o motivo.

**Cuidado com o diagnóstico.** Emissões repetidas de token fazem a ML responder
`invalid client_id or client_secret` mesmo com chaves certas. Se você testou
várias vezes seguidas, espere alguns minutos antes de concluir que a chave está
errada — a mensagem de erro do conector já avisa sobre isso.

## 2. Segurança das chaves

- Segredos são cifrados com **AES-256-GCM** antes de ir ao banco
  ([crypto.ts](../src/server/core/crypto.ts)). GCM é autenticado: adulterar o
  ciphertext causa erro de decriptação em vez de devolver lixo silenciosamente.
- A chave mestra vem de `CREDENTIALS_ENCRYPTION_KEY` e **nunca fica no banco**.
  Quem tiver um dump do Postgres não tem as credenciais das lojas.
- Campos não sensíveis (site, região) ficam legíveis de propósito —
  criptografá-los dificultaria a operação sem proteger nada.
- A API nunca devolve um segredo em claro: apenas `1234••••••cdef`.
- Rotação cria uma nova versão e marca a anterior com `rotatedAt`, em vez de
  sobrescrever. Se a credencial nova falhar, a antiga ainda está lá.

Gere a chave com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Estado de cada conector

| Loja | Situação | Autenticação | Verificação |
| --- | --- | --- | --- |
| **Mercado Livre** | disponível | OAuth2 `client_credentials` | Exercitado contra a API real: chaves inválidas retornam erro correto em ~250 ms |
| **Shopee** | experimental | Assinatura SHA-256 por requisição | Alcança a API real e recebe resposta dela; **não testado com credenciais válidas** |
| **Amazon** | em breve | AWS SigV4 (PA-API 5) | Campos definidos, conector não implementado |
| **Referência** | disponível | nenhuma | Determinístico, sem rede |

Nenhum conector foi exercitado com **credenciais válidas** — não tenho contas
de parceiro. O que está provado é que o caminho completo funciona e que os
erros da loja chegam legíveis à tela. O primeiro teste com chaves reais suas é
o que fecha essa lacuna.

## 4. Adicionar uma loja nova

Dois arquivos:

**1. Descreva no catálogo** ([catalog.ts](../src/server/providers/catalog.ts)):

```ts
{
  key: "minhaloja-v1",
  storeName: "Minha Loja",
  storeSlug: "minha-loja",
  status: "disponivel",
  credentialFields: [
    { id: "api_key", label: "API Key", type: "password", required: true, secret: true },
  ],
  setupSteps: ["Onde o operador encontra essa chave"],
  // …
}
```

A tela de seleção, o formulário e a validação passam a existir sozinhos.

**2. Implemente o conector** seguindo a interface `StoreConnector`, e registre
em `ensureRegistrations()` no [bootstrap](../src/server/bootstrap.ts).

O `healthCheck` deve **provar que o token é aceito**, não apenas que foi
emitido — por isso o conector do Mercado Livre faz uma consulta mínima ao
catálogo depois de autenticar. Um teste que só valida a emissão do token
aprovaria credenciais sem permissão de leitura.

## 5. API

| Método | Rota | Depende do banco? |
| --- | --- | --- |
| GET | `/api/v1/connectors` | não |
| POST | `/api/v1/connectors/test` | **não** |
| POST | `/api/v1/connectors` | sim |

`POST /connectors/test` responde sempre 200: credencial recusada é resultado
válido do teste, não erro da requisição. O veredicto está no campo `ok`.
