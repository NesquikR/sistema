import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const globalForFirebase = globalThis as unknown as {
  __beautybotFirebaseAdmin?: any;
  __beautybotFirestore?: any;
};

function createFirebaseAdminApp() {
  const activeApps = getApps();
  if (activeApps.length > 0) {
    return activeApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "sistema-2-45625";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }

  // Fallback para inicialização automática (implícito ou por emulador)
  return initializeApp({
    projectId,
  });
}

export const firebaseAdmin = globalForFirebase.__beautybotFirebaseAdmin ?? createFirebaseAdminApp();

if (process.env.NODE_ENV !== "production") {
  globalForFirebase.__beautybotFirebaseAdmin = firebaseAdmin;
}

const initializeFirestore = () => {
  const db = getFirestore(firebaseAdmin);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // Ignora erro de settings já configurado
  }
  return db;
};

export const firestore = globalForFirebase.__beautybotFirestore ?? initializeFirestore();

if (process.env.NODE_ENV !== "production") {
  globalForFirebase.__beautybotFirestore = firestore;
}

