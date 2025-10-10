import OpenAI from "openai";
import fs from "fs/promises";
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function labelClusters() {
  const file = await fs.readFile("clustered.json", "utf8");
  const rawData = JSON.parse(file);
  const rows = Object.values(rawData);

  // Cluster gruppieren
  const clusters = {};
  rows.forEach((r) => {
    if (!clusters[r.cluster]) clusters[r.cluster] = [];
    clusters[r.cluster].push(r["Indicator English"]);
  });

  const labels = {};
  for (let [clusterId, indicators] of Object.entries(clusters)) {
    const prompt = `
    Hier sind einige Indikatoren:
    ${indicators.slice(0, 10).join("\n")} 

    Bitte finde eine kurzen Teaser (bis zu 7 Wörter), die den gemeinsamen Inhalt beschreibt. Mache die Überschrift so spezifisch und inhaltlich wie möglich
    `;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
    });

    labels[clusterId] = res.choices[0].message.content.trim();
  }

  // Labels zu den Daten schreiben
  const labeled = rows.map((r) => ({
    ...r,
    clusterLabel: labels[r.cluster],
  }));

  await fs.writeFile(
    "clustered-labeled.json",
    JSON.stringify(labeled, null, 2)
  );
  console.log("✅ cluster labels geschrieben:", labels);
}

labelClusters();
