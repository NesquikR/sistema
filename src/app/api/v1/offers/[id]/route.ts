import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, withApiHandler, type RouteContext } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { offerRepository } from "@/server/repositories/offer.repository";
import { offerService } from "@/server/services/offer.service";
import { queueService } from "@/server/queue/queue.service";
import type { OfferStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { id: string };

const patchBodySchema = z.object({
  status: z.enum(["fila", "aprovada", "agendada", "publicada", "ignorada", "expirada"]).optional(),
  scheduledFor: z.string().optional(),
});

export const PATCH = withApiHandler<Params>(
  async (request: NextRequest, context: RouteContext<Params>) => {
    await bootstrap("web");
    const { id } = context.params;
    const body = await parseBody(request, patchBodySchema);

    // 1. Buscar a oferta no banco para validar
    const offer = await offerRepository.findById(id);
    if (!offer) {
      throw new Error(`Oferta ${id} não encontrada`);
    }

    let updatedOffer = offer;

    // 2. Se for reagendamento (ou status agendado com data)
    if (body.scheduledFor) {
      const scheduledDate = new Date(body.scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error("Data de agendamento inválida");
      }
      updatedOffer = await offerRepository.transition(id, "SCHEDULED", {
        actorType: "USER",
        reason: `Reagendada manualmente para ${scheduledDate.toISOString()}`,
        scheduledFor: scheduledDate,
      });
    }
    // 3. Senão, se for mudança de status geral
    else if (body.status) {
      if (body.status === "publicada" || body.status === "aprovada") {
        // Transiciona para APPROVED no banco
        updatedOffer = await offerRepository.transition(id, "APPROVED", {
          actorType: "USER",
          decisionSource: "MANUAL",
          reason: "Aprovada manualmente pelo operador para publicação imediata",
        });

        // Enfileira disparo imediato para o worker
        await queueService.enqueueOnce(
          "publishing.send-offer",
          { offerId: id },
          `send-offer-${id}`,
        );
      } else if (body.status === "ignorada") {
        updatedOffer = await offerRepository.transition(id, "REJECTED", {
          actorType: "USER",
          decisionSource: "MANUAL",
          reason: "Cancelada/ignorada manualmente pelo operador",
        });
      } else if (body.status === "agendada") {
        // Se mudou para agendada sem data de agendamento explícita, agenda para daqui a 30 min por padrão
        const defaultDate = new Date(Date.now() + 30 * 60_000);
        updatedOffer = await offerRepository.transition(id, "SCHEDULED", {
          actorType: "USER",
          reason: "Agendada manualmente pelo operador (padrão 30min)",
          scheduledFor: defaultDate,
        });
      }
    }

    return ok(updatedOffer);
  },
  { name: "PATCH /api/v1/offers/[id]" }
);
