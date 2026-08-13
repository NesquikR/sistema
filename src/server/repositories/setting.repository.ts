import type { Prisma, Setting, SettingScope } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository } from "./base.repository";

export const GLOBAL_SCOPE_ID = "";

function mapDocToSetting(doc: any): Setting {
  const data = doc.data();
  return {
    id: doc.id,
    key: data.key,
    scope: data.scope ?? "GLOBAL",
    scopeId: data.scopeId ?? GLOBAL_SCOPE_ID,
    value: data.value,
    valueType: data.valueType ?? "STRING",
    defaultValue: data.defaultValue ?? null,
    isSecret: data.isSecret ?? false,
    isEditable: data.isEditable ?? true,
    description: data.description ?? null,
    updatedByUserId: data.updatedByUserId ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

export class SettingRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async findAll(scope?: SettingScope): Promise<Setting[]> {
    let query: any = firestore.collection("settings");
    if (scope) {
      query = query.where("scope", "==", scope);
    }
    const snapshot = await query.get();
    const items = snapshot.docs.map(mapDocToSetting);
    
    items.sort((a: Setting, b: Setting) => a.key.localeCompare(b.key));
    return items;
  }

  async findOne(key: string, scope: SettingScope = "GLOBAL", scopeId = GLOBAL_SCOPE_ID): Promise<Setting | null> {
    const docId = `${key}_${scope}_${scopeId}`;
    const doc = await firestore.collection("settings").doc(docId).get();
    if (!doc.exists) return null;
    return mapDocToSetting(doc);
  }

  async resolve(
    key: string,
    chain: { scope: SettingScope; scopeId: string }[],
  ): Promise<Setting | null> {
    for (const level of chain) {
      const found = await this.findOne(key, level.scope, level.scopeId);
      if (found) return found;
    }
    return this.findOne(key);
  }

  async upsert(input: {
    key: string;
    scope?: SettingScope;
    scopeId?: string;
    value: Prisma.InputJsonValue;
    valueType?: Setting["valueType"];
    description?: string;
    updatedByUserId?: string;
  }): Promise<Setting> {
    const scope = input.scope ?? "GLOBAL";
    const scopeId = input.scopeId ?? GLOBAL_SCOPE_ID;
    const docId = `${input.key}_${scope}_${scopeId}`;

    const docRef = firestore.collection("settings").doc(docId);
    const doc = await docRef.get();

    const now = new Date();
    const data: Record<string, any> = {
      key: input.key,
      scope,
      scopeId,
      value: input.value,
      updatedAt: now,
    };

    if (input.valueType) {
      data.valueType = input.valueType;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.updatedByUserId !== undefined) {
      data.updatedByUserId = input.updatedByUserId;
    }

    if (!doc.exists) {
      data.createdAt = now;
      data.defaultValue = null;
      data.isSecret = false;
      data.isEditable = true;
      await docRef.set(data);
    } else {
      await docRef.update(data);
    }

    const updated = await docRef.get();
    return mapDocToSetting(updated);
  }

  async recordHistory(input: {
    settingId: string;
    oldValue?: Prisma.InputJsonValue;
    newValue: Prisma.InputJsonValue;
    changedByUserId?: string;
    reason?: string;
  }): Promise<any> {
    const historyId = firestore.collection("settings_history").doc().id;
    const data = {
      settingId: input.settingId,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue,
      changedByUserId: input.changedByUserId ?? null,
      reason: input.reason ?? null,
      createdAt: new Date(),
    };

    await firestore.collection("settings_history").doc(historyId).set(data);
    return { id: historyId, ...data };
  }

  async history(settingId: string, limit = 50): Promise<any[]> {
    const snapshot = await firestore
      .collection("settings_history")
      .where("settingId", "==", settingId)
      .get();

    const rows = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        settingId: data.settingId,
        oldValue: data.oldValue,
        newValue: data.newValue,
        changedByUserId: data.changedByUserId,
        reason: data.reason,
        createdAt: data.createdAt?.toDate() ?? new Date(),
      };
    });

    rows.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    return rows.slice(0, limit);
  }
}

export const settingRepository = new SettingRepository();
