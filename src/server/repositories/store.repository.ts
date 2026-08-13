import { Prisma, type Store } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository, toPage, type Page } from "./base.repository";
import { encrypt, decrypt } from "@/server/core/crypto";

export interface StoreFilter {
  isActive?: boolean;
  status?: Prisma.EnumStoreStatusFilter["equals"];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StoreCredentialRow {
  id: string;
  storeId: string;
  key: string;
  valueEncrypted: string;
  version: number;
  createdAt: Date;
  rotatedAt: Date | null;
}

function mapDocToStore(doc: any): Store {
  const data = doc.data();
  return {
    id: doc.id,
    slug: data.slug,
    name: data.name,
    legalName: data.legalName ?? null,
    homepageUrl: data.homepageUrl ?? null,
    logoUrl: data.logoUrl ?? null,
    accentColor: data.accentColor ?? null,
    connectorKey: data.connectorKey,
    connectorVersion: data.connectorVersion ?? "1.0.0",
    integrationType: data.integrationType ?? "SCRAPER",
    baseUrl: data.baseUrl ?? null,
    config: data.config ?? null,
    status: data.status ?? "ACTIVE",
    isActive: data.isActive ?? true,
    priority: data.priority ?? 100,
    rateLimitPerMinute: data.rateLimitPerMinute ?? 60,
    quotaDailyLimit: data.quotaDailyLimit ?? null,
    quotaDailyUsed: data.quotaDailyUsed ?? 0,
    quotaResetAt: data.quotaResetAt?.toDate() ?? null,
    defaultCommissionRate: new Prisma.Decimal(data.defaultCommissionRate ?? 0),
    currency: data.currency ?? "BRL",
    timezone: data.timezone ?? "America/Sao_Paulo",
    healthStatus: data.healthStatus ?? "UNKNOWN",
    lastSyncAt: data.lastSyncAt?.toDate() ?? null,
    nextSyncAt: data.nextSyncAt?.toDate() ?? null,
    lastSuccessAt: data.lastSuccessAt?.toDate() ?? null,
    consecutiveFailures: data.consecutiveFailures ?? 0,
    avgLatencyMs: data.avgLatencyMs ?? null,
    successRate: data.successRate ? new Prisma.Decimal(data.successRate) : null,
    metadata: data.metadata ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
    deletedAt: data.deletedAt?.toDate() ?? null,
  };
}

export class StoreRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async findMany(filter: StoreFilter = {}): Promise<Page<Store>> {
    const { limit = 50, offset = 0 } = filter;
    
    let query = firestore.collection("stores").where("deletedAt", "==", null);

    if (filter.isActive !== undefined) {
      query = query.where("isActive", "==", filter.isActive);
    }
    if (filter.status) {
      query = query.where("status", "==", filter.status);
    }

    const snapshot = await query.get();
    let items: Store[] = snapshot.docs.map(mapDocToStore);

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      items = items.filter(
        (store: Store) =>
          store.name.toLowerCase().includes(searchLower) ||
          store.slug.toLowerCase().includes(searchLower) ||
          store.connectorKey.toLowerCase().includes(searchLower),
      );
    }

    items.sort((a: Store, b: Store) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.name.localeCompare(b.name);
    });

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return toPage(pagedItems, total, limit, offset);
  }

  async findById(id: string): Promise<Store | null> {
    const doc = await firestore.collection("stores").doc(id).get();
    if (!doc.exists || doc.data()?.deletedAt !== null) return null;
    return mapDocToStore(doc);
  }

  async findBySlug(slug: string): Promise<Store | null> {
    const snapshot = await firestore
      .collection("stores")
      .where("slug", "==", slug)
      .where("deletedAt", "==", null)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return mapDocToStore(snapshot.docs[0]);
  }

  async findByConnectorKey(connectorKey: string): Promise<Store | null> {
    const snapshot = await firestore
      .collection("stores")
      .where("connectorKey", "==", connectorKey)
      .where("deletedAt", "==", null)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return mapDocToStore(snapshot.docs[0]);
  }

  async findDueForSync(now: Date, limit = 20): Promise<Store[]> {
    const snapshot = await firestore
      .collection("stores")
      .where("deletedAt", "==", null)
      .where("isActive", "==", true)
      .where("status", "==", "ACTIVE")
      .get();

    const items: Store[] = snapshot.docs.map(mapDocToStore);
    
    const dueItems = items.filter(
      (store: Store) => !store.nextSyncAt || store.nextSyncAt <= now,
    );

    dueItems.sort((a: Store, b: Store) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aTime = a.nextSyncAt?.getTime() ?? 0;
      const bTime = b.nextSyncAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    return dueItems.slice(0, limit);
  }

  async create(data: Prisma.StoreCreateInput): Promise<Store> {
    const id = data.id || firestore.collection("stores").doc().id;
    const storeDocRef = firestore.collection("stores").doc(id);

    const storeData = {
      slug: data.slug,
      name: data.name,
      legalName: data.legalName ?? null,
      homepageUrl: data.homepageUrl ?? null,
      logoUrl: data.logoUrl ?? null,
      accentColor: data.accentColor ?? null,
      connectorKey: data.connectorKey,
      connectorVersion: data.connectorVersion ?? "1.0.0",
      integrationType: data.integrationType ?? "SCRAPER",
      baseUrl: data.baseUrl ?? null,
      config: data.config ?? null,
      status: data.status ?? "ACTIVE",
      isActive: data.isActive ?? true,
      priority: data.priority ?? 100,
      rateLimitPerMinute: data.rateLimitPerMinute ?? 60,
      quotaDailyLimit: data.quotaDailyLimit ?? null,
      quotaDailyUsed: data.quotaDailyUsed ?? 0,
      quotaResetAt: data.quotaResetAt ? new Date(data.quotaResetAt as any) : null,
      defaultCommissionRate: data.defaultCommissionRate ? Number(data.defaultCommissionRate) : 0,
      currency: data.currency ?? "BRL",
      timezone: data.timezone ?? "America/Sao_Paulo",
      healthStatus: data.healthStatus ?? "UNKNOWN",
      lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt as any) : null,
      nextSyncAt: data.nextSyncAt ? new Date(data.nextSyncAt as any) : null,
      lastSuccessAt: data.lastSuccessAt ? new Date(data.lastSuccessAt as any) : null,
      consecutiveFailures: data.consecutiveFailures ?? 0,
      avgLatencyMs: data.avgLatencyMs ?? null,
      successRate: data.successRate ? Number(data.successRate) : null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    await storeDocRef.set(storeData);
    
    const createdDoc = await storeDocRef.get();
    return mapDocToStore(createdDoc);
  }

  async update(id: string, data: Prisma.StoreUpdateInput): Promise<Store> {
    const storeDocRef = firestore.collection("stores").doc(id);
    const doc = await storeDocRef.get();
    if (!doc.exists) {
      throw new Error(`Loja com ID ${id} não encontrada para atualização.`);
    }

    const currentData = doc.data()!;
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    const fields = [
      "name", "slug", "connectorKey", "integrationType", "accentColor",
      "status", "isActive", "healthStatus", "avgLatencyMs", "priority",
      "legalName", "homepageUrl", "logoUrl", "connectorVersion", "baseUrl",
      "config", "rateLimitPerMinute", "quotaDailyLimit", "quotaDailyUsed",
      "currency", "timezone", "metadata"
    ];
    
    const inputData = data as any;
    for (const field of fields) {
      if (inputData[field] !== undefined) {
        updateData[field] = inputData[field];
      }
    }

    if (inputData.lastSyncAt !== undefined) {
      updateData.lastSyncAt = inputData.lastSyncAt ? new Date(inputData.lastSyncAt as any) : null;
    }
    if (inputData.nextSyncAt !== undefined) {
      updateData.nextSyncAt = inputData.nextSyncAt ? new Date(inputData.nextSyncAt as any) : null;
    }
    if (inputData.lastSuccessAt !== undefined) {
      updateData.lastSuccessAt = inputData.lastSuccessAt ? new Date(inputData.lastSuccessAt as any) : null;
    }
    if (inputData.deletedAt !== undefined) {
      updateData.deletedAt = inputData.deletedAt ? new Date(inputData.deletedAt as any) : null;
    }
    if (inputData.quotaResetAt !== undefined) {
      updateData.quotaResetAt = inputData.quotaResetAt ? new Date(inputData.quotaResetAt as any) : null;
    }
    if (inputData.defaultCommissionRate !== undefined) {
      updateData.defaultCommissionRate = inputData.defaultCommissionRate ? Number(inputData.defaultCommissionRate) : 0;
    }
    if (inputData.successRate !== undefined) {
      updateData.successRate = inputData.successRate ? Number(inputData.successRate) : null;
    }

    if (inputData.consecutiveFailures !== undefined) {
      const cf = inputData.consecutiveFailures;
      if (cf && typeof cf === "object" && "increment" in cf) {
        updateData.consecutiveFailures = (currentData.consecutiveFailures ?? 0) + (cf.increment ?? 1);
      } else {
        updateData.consecutiveFailures = cf;
      }
    }

    await storeDocRef.update(updateData);
    const updatedDoc = await storeDocRef.get();
    return mapDocToStore(updatedDoc);
  }

  async softDelete(id: string): Promise<Store> {
    return this.update(id, {
      deletedAt: new Date(),
      isActive: false,
      status: "DEPRECATED",
    });
  }

  async countByStatus(): Promise<{ status: Store["status"]; _count: { _all: number } }[]> {
    const snapshot = await firestore.collection("stores").where("deletedAt", "==", null).get();
    const stores: Store[] = snapshot.docs.map(mapDocToStore);
    
    const counts: Record<string, number> = {};
    for (const store of stores) {
      counts[store.status] = (counts[store.status] || 0) + 1;
    }

    return Object.entries(counts).map(([status, count]) => ({
      status: status as Store["status"],
      _count: { _all: count },
    }));
  }

  // ============================================================================
  // OPERAÇÕES DE CREDENCIAIS
  // ============================================================================

  async installStoreWithCredentials(
    storeInput: {
      slug: string;
      name: string;
      connectorKey: string;
      integrationType: Store["integrationType"];
      accentColor?: string | null;
      status: Store["status"];
      isActive: boolean;
      healthStatus: Store["healthStatus"];
      lastSuccessAt?: Date;
    },
    credentials: Record<string, string>,
    definition: { credentialFields: Array<{ id: string; secret: boolean }> }
  ): Promise<Store> {
    const storeId = firestore.collection("stores").doc().id;
    const storeDocRef = firestore.collection("stores").doc(storeId);

    const storeData = {
      slug: storeInput.slug,
      name: storeInput.name,
      legalName: null,
      homepageUrl: null,
      logoUrl: null,
      accentColor: storeInput.accentColor ?? null,
      connectorKey: storeInput.connectorKey,
      connectorVersion: "1.0.0",
      integrationType: storeInput.integrationType,
      baseUrl: null,
      config: null,
      status: storeInput.status,
      isActive: storeInput.isActive,
      priority: 100,
      rateLimitPerMinute: 60,
      quotaDailyLimit: null,
      quotaDailyUsed: 0,
      quotaResetAt: null,
      defaultCommissionRate: 0,
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      healthStatus: storeInput.healthStatus,
      lastSyncAt: null,
      nextSyncAt: null,
      lastSuccessAt: storeInput.lastSuccessAt ?? new Date(),
      consecutiveFailures: 0,
      avgLatencyMs: null,
      successRate: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const batch = firestore.batch();
    batch.set(storeDocRef, storeData);

    const fields = definition.credentialFields.filter(
      (f) => credentials[f.id]?.trim(),
    );

    for (const field of fields) {
      const value = credentials[field.id].trim();
      const credentialId = firestore.collection("store_credentials").doc().id;
      const credentialRef = firestore.collection("store_credentials").doc(credentialId);

      batch.set(credentialRef, {
        storeId,
        key: field.id,
        valueEncrypted: field.secret ? encrypt(value) : value,
        version: 1,
        createdAt: new Date(),
        rotatedAt: null,
      });
    }

    await batch.commit();

    const createdDoc = await storeDocRef.get();
    return mapDocToStore(createdDoc);
  }

  async listCredentials(storeId: string): Promise<StoreCredentialRow[]> {
    const snapshot = await firestore
      .collection("store_credentials")
      .where("storeId", "==", storeId)
      .where("rotatedAt", "==", null)
      .get();

    const rows = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        storeId: data.storeId,
        key: data.key,
        valueEncrypted: data.valueEncrypted,
        version: data.version ?? 1,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        rotatedAt: data.rotatedAt?.toDate() ?? null,
      };
    });

    rows.sort((a: StoreCredentialRow, b: StoreCredentialRow) => {
      if (a.key !== b.key) return a.key.localeCompare(b.key);
      return b.version - a.version;
    });

    return rows;
  }

  async loadCredentials(storeId: string, definition: any): Promise<Record<string, string>> {
    const snapshot = await firestore
      .collection("store_credentials")
      .where("storeId", "==", storeId)
      .where("rotatedAt", "==", null)
      .get();

    const rows = snapshot.docs.map((doc: any) => doc.data());
    rows.sort((a: any, b: any) => (b.version ?? 1) - (a.version ?? 1));

    const credentials: Record<string, string> = {};
    for (const row of rows) {
      if (credentials[row.key] !== undefined) continue;
      const field = definition?.credentialFields.find((f: any) => f.id === row.key);
      credentials[row.key] = field?.secret ? decrypt(row.valueEncrypted) : row.valueEncrypted;
    }
    return credentials;
  }

  async rotateCredentials(
    storeId: string,
    credentials: Record<string, string>,
    definition: { credentialFields: Array<{ id: string; secret: boolean }> }
  ): Promise<void> {
    const batch = firestore.batch();

    for (const [key, value] of Object.entries(credentials)) {
      if (!value?.trim()) continue;

      const field = definition.credentialFields.find((f) => f.id === key);
      
      const snapshot = await firestore
        .collection("store_credentials")
        .where("storeId", "==", storeId)
        .where("key", "==", key)
        .where("rotatedAt", "==", null)
        .limit(1)
        .get();

      let currentVersion = 0;
      if (!snapshot.empty) {
        const activeDoc = snapshot.docs[0];
        currentVersion = activeDoc.data().version ?? 1;
        
        batch.update(activeDoc.ref, {
          rotatedAt: new Date(),
        });
      }

      const credentialId = firestore.collection("store_credentials").doc().id;
      const credentialRef = firestore.collection("store_credentials").doc(credentialId);

      batch.set(credentialRef, {
        storeId,
        key,
        valueEncrypted: field?.secret ? encrypt(value.trim()) : value.trim(),
        version: currentVersion + 1,
        createdAt: new Date(),
        rotatedAt: null,
      });
    }

    await batch.commit();
  }
}

export const storeRepository = new StoreRepository();
