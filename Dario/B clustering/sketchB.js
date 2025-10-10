let rawData; // das komplette JSON als Objekt
let data; //Daten als Array
let embeddings; // Array der Embeddings, parallel zu den Indikatoren
let indicators; // Texte

let currentIndex = 0; // Start-Indikator
let visited = [];

let next = null; // nächster Indikator

function preload() {
  // clustered.json: [{text: "Jobs ...", embedding: [0.01, ...]}, ...]
  rawData = loadJSON("/Data/clustered.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Arial");
  textSize(16);

  data = Object.values(rawData);
  // Extrahiere Arrays
  indicators = data;
  embeddings = data.map((d) => d.embedding);

  currentIndex = floor(random(indicators.length));
  visited.push(currentIndex);

  next = findNextClosest(currentIndex);
  visited.push(next);
}

function draw() {
  background(255);

  drawIndicators(currentIndex, "thisIndicator");
  //text("Aktueller Indikator:", 20, 40);
  //text(indicators[currentIndex]["Indicator English"], 20, 70, width-40);

  //text("Nächster Vorschlag:", 20, 140);
  //
  if (next !== null) {
    drawIndicators(next, "nextIndicator");
    //text(indicators[next]["Indicator English"], 20, 170, width-40);
  }
}

// Taste: neuen nächsten Indikator wählen
function keyPressed() {
  let next = findNextClosest(currentIndex);
  if (next !== null) {
    currentIndex = next;
    visited.push(currentIndex);
  }
}

// Cosine Similarity
function cosineSim(vecA, vecB) {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Finde nächsten noch nicht besuchten Indikator
function findNextClosest(index) {
  let bestSim = -1;
  let bestIdx = null;
  for (let i = 0; i < embeddings.length; i++) {
    if (i === index || visited.includes(i)) continue;
    let sim = cosineSim(embeddings[index], embeddings[i]);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Finde den am weitesten entfernten noch nicht besuchten Indikator
function findNextFurthest(index) {
  let worstSim = 1;
  let worstIdx = null;
  for (let i = 0; i < embeddings.length; i++) {
    if (i === index || visited.includes(i)) continue;
    let sim = cosineSim(embeddings[index], embeddings[i]);
    if (sim < worstSim) {
      worstSim = sim;
      worstIdx = i;
    }
  }
  return worstIdx;
}

function drawIndicators(index, id) {
  let indicator = document.getElementById(id);
  //console.log(indicator)
  indicator.querySelector("h2").textContent =
    indicators[index]["Indicator English"];
  indicator.querySelector(".cluster").textContent =
    "KI generated Cluster Title: " + indicators[index]["clusterLabel"];
  indicator.querySelector(".group").textContent =
    indicators[index]["Focus Group"];
  indicator.querySelector(".community").textContent =
    indicators[index]["Community"];
  indicator.querySelector(".Impscore").textContent =
    indicators[index]["Imp score"];
}

document.getElementById("closestIndicator").addEventListener("click", () => {
  currentIndex = next;
  next = findNextClosest(currentIndex);
  if (next !== null) {
    visited.push(next);
  }
});

document.getElementById("oppositeIndicator").addEventListener("click", () => {
  currentIndex = next;
  next = findNextFurthest(currentIndex);
  if (next !== null) {
    visited.push(next);
  }
});

function drawIndicators(index, id) {
  let indicator = document.getElementById(id);

  const h2 = indicator.querySelector("h2");
  const score = parseFloat(indicators[index]["Imp score"]);

  // Titeltext setzen
  h2.textContent = indicators[index]["Indicator English"];

  // Schriftgrösse dynamisch nach Imp score
  const baseSize = 22; // px
  h2.style.fontSize = `${baseSize * score}px`;

  // Farbe nach Score
  if (score > 2) {
    h2.style.color = "green";
  } else if (score >= 1 && score <= 2) {
    h2.style.color = "orange";
  } else {
    h2.style.color = "red";
  }

  // Restliche Infos
  indicator.querySelector(".cluster").textContent =
    "KI generated Cluster Title: " + indicators[index]["clusterLabel"];
  indicator.querySelector(".group").textContent =
    indicators[index]["Focus Group"];
  indicator.querySelector(".community").textContent =
    indicators[index]["Community"];
  indicator.querySelector(".Impscore").textContent =
    indicators[index]["Imp score"];
}
