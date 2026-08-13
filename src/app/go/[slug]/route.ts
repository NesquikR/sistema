import { type NextRequest, NextResponse } from "next/server";
import { affiliateService } from "@/server/services/affiliate.service";
import { bootstrap } from "@/server/bootstrap";

/**
 * Redirecionador de Links de Afiliados.
 *
 * Rota pública: GET /go/[slug]
 *
 * Ao receber o acesso:
 * 1. Inicializa o contexto do sistema (bootstrap)
 * 2. Rastreia o clique incrementando a métrica e gerando o registro
 * 3. Redireciona o usuário para a URL de destino da loja de afiliado
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    // Garante que o bootstrap rodou
    await bootstrap("web");

    const targetUrl = await affiliateService.trackClick(slug);

    // Redirecionamento temporário 307
    return NextResponse.redirect(targetUrl, 307);
  } catch (error) {
    // Fallback amigável se o link não existir
    const homeUrl = new URL("/", _request.nextUrl.origin).toString();
    return NextResponse.redirect(homeUrl, 307);
  }
}
