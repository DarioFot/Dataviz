import fs from "fs/promises";
import kmeans from "ml-kmeans";

async function main() {
  // 1) JSON laden
  const file = await fs.readFile("embeddings.json", "utf8");
  const rawData = JSON.parse(file);
  const rows = Object.values(rawData);

  // 2) Embeddings extrahieren
  // Falls Embeddings im JSON als Float32Array oder Objekt vorliegen, in normales Array konvertieren
  const embeddings = rows.map(r => r.embedding);

  // 3) KMeans-Funktion robust importieren
  const kmeansFunc = kmeans.default ?? kmeans.kmeans ?? kmeans;
  if (typeof kmeansFunc !== "function") {
    console.error("ml-kmeans exports:", kmeans);
    throw new Error("kmeans-Funktion nicht gefunden.");
  }

  // 4) Cluster berechnen
  const k = 20; // Anzahl Cluster (kannst du anpassen)
  const res = kmeansFunc(embeddings, k);

  // Ergebnis enthält meist `clusters` (Cluster-Zuordnung je Punkt) und `centroids`
  console.log("Cluster keys:", Object.keys(res));

  // 5) Cluster-Label den Rows hinzufügen
  const clustered = rows.map((r, i) => ({
    ...r,
    cluster: res.clusters[i], // jedes Embedding bekommt ein Cluster
  }));

  // 6) Neues JSON abspeichern
  await fs.writeFile("clustered.json", JSON.stringify(clustered, null, 2));
  console.log("✅ clustered.json geschrieben");
}

main().catch(err => console.error(err));
