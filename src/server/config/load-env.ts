/**
 * Carrega o .env em processos que não passam pelo Next.js.
 *
 * O servidor web recebe as variáveis do próprio framework; o worker e os
 * scripts de CLI rodam em `tsx` puro e não recebem nada. Este módulo precisa
 * ser o **primeiro import** desses entrypoints: os imports são avaliados em
 * ordem, e qualquer módulo que leia `process.env` durante a própria avaliação
 * (como o cliente do Prisma) veria variáveis vazias se viesse antes.
 */
import "dotenv/config";
