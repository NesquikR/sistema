import { Prisma, type AffiliateLink, type AffiliateProgram } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository } from "./base.repository";

function mapDocToProgram(doc: any): AffiliateProgram {
  const data = doc.data();
  return {
    id: doc.id,
    storeId: data.storeId,
    name: data.name ?? "Programa de Afiliados",
    network: data.network,
    trackingTag: data.trackingTag ?? null,
    commissionRate: new Prisma.Decimal(data.commissionRate ?? 0),
    cookieDays: data.cookieDays ?? 30,
    paymentTermDays: data.paymentTermDays ?? 60,
    isActive: data.isActive ?? true,
    config: data.config ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

function mapDocToLink(doc: any): AffiliateLink {
  const data = doc.data();
  return {
    id: doc.id,
    storeId: data.storeId,
    programId: data.programId ?? null,
    productId: data.productId ?? null,
    offerId: data.offerId ?? null,
    originalUrl: data.originalUrl,
    targetUrl: data.targetUrl,
    shortSlug: data.shortSlug,
    trackingTag: data.trackingTag ?? null,
    clickCount: data.clickCount ?? 0,
    conversionCount: data.conversionCount ?? 0,
    revenue: new Prisma.Decimal(data.revenue ?? 0),
    isActive: data.isActive ?? true,
    expiresAt: data.expiresAt?.toDate() ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

export class AffiliateRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async findProgram(storeId: string, network: string): Promise<AffiliateProgram | null> {
    const snapshot = await firestore
      .collection("affiliate_programs")
      .where("storeId", "==", storeId)
      .where("network", "==", network)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return mapDocToProgram(snapshot.docs[0]);
  }

  async findDefaultProgramForStore(storeId: string): Promise<AffiliateProgram | null> {
    const snapshot = await firestore
      .collection("affiliate_programs")
      .where("storeId", "==", storeId)
      .where("isActive", "==", true)
      .get();

    if (snapshot.empty) return null;
    const programs = snapshot.docs.map(mapDocToProgram);
    
    programs.sort((a: AffiliateProgram, b: AffiliateProgram) => {
      const rateA = Number(a.commissionRate);
      const rateB = Number(b.commissionRate);
      return rateB - rateA;
    });
    return programs[0];
  }

  async findByShortSlug(shortSlug: string): Promise<AffiliateLink | null> {
    const snapshot = await firestore
      .collection("affiliate_links")
      .where("shortSlug", "==", shortSlug)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return mapDocToLink(snapshot.docs[0]);
  }

  async findLinkForOffer(offerId: string): Promise<AffiliateLink | null> {
    const snapshot = await firestore
      .collection("affiliate_links")
      .where("offerId", "==", offerId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return mapDocToLink(snapshot.docs[0]);
  }

  async createLink(data: {
    storeId: string;
    programId?: string;
    productId?: string;
    offerId?: string;
    originalUrl: string;
    targetUrl: string;
    shortSlug: string;
    trackingTag?: string;
  }): Promise<AffiliateLink> {
    const id = firestore.collection("affiliate_links").doc().id;
    const linkDocRef = firestore.collection("affiliate_links").doc(id);

    const now = new Date();
    const linkData = {
      storeId: data.storeId,
      programId: data.programId ?? null,
      productId: data.productId ?? null,
      offerId: data.offerId ?? null,
      originalUrl: data.originalUrl,
      targetUrl: data.targetUrl,
      shortSlug: data.shortSlug,
      trackingTag: data.trackingTag ?? null,
      clickCount: 0,
      conversionCount: 0,
      revenue: 0,
      isActive: true,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await linkDocRef.set(linkData);
    const createdDoc = await linkDocRef.get();
    return mapDocToLink(createdDoc);
  }

  async incrementClick(id: string): Promise<void> {
    const docRef = firestore.collection("affiliate_links").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return;

    const currentCount = doc.data()?.clickCount ?? 0;
    await docRef.update({
      clickCount: currentCount + 1,
      updatedAt: new Date(),
    });
  }

  async recordClick(affiliateLinkId: string, offerId: string | null): Promise<any> {
    const id = firestore.collection("clicks").doc().id;
    const clickData = {
      affiliateLinkId,
      offerId: offerId ?? null,
      isUnique: true,
      createdAt: new Date(),
    };

    await firestore.collection("clicks").doc(id).set(clickData);
    return { id, ...clickData };
  }
}

export const affiliateRepository = new AffiliateRepository();
