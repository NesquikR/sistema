import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDvmnouvrfF-VLNX_6TTYhOjbSRgD2eIAA",
  authDomain: "sistema-2-45625.firebaseapp.com",
  projectId: "sistema-2-45625",
  storageBucket: "sistema-2-45625.firebasestorage.app",
  messagingSenderId: "539435289867",
  appId: "1:539435289867:web:47778987ba6e225944a60e",
  measurementId: "G-9M2SSKXSER"
};

// Inicializa o Firebase apenas se não houver instância ativa
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Função para carregar o Analytics somente no client-side
export const initAnalytics = async () => {
  if (typeof window !== "undefined") {
    const supported = await isSupported();
    if (supported) {
      return getAnalytics(app);
    }
  }
  return null;
};

export { app };
