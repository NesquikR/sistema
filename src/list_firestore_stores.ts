import "@/server/config/load-env";
import { bootstrap } from "./server/bootstrap";
import { firestore } from "./server/firebase-admin";

async function main() {
  await bootstrap("worker");
  console.log("Buscando todas as lojas diretamente da coleção 'stores' no Firestore...");
  
  const snapshot = await firestore.collection("stores").get();
  console.log(`Documentos encontrados na coleção 'stores': ${snapshot.size}`);
  
  snapshot.docs.forEach((doc) => {
    console.log(`ID: ${doc.id}`);
    console.log("Dados:", JSON.stringify(doc.data(), null, 2));
    console.log("-----------------------------------------");
  });
}

main().catch(console.error);
