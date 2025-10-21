let rawData;
let dataArray = [];
let filteredArray;
let embeddings = [];
let closest5 = [];
let selectedIndicator = null;
let firstCommunityLabelIndices = new Set();
const communityNames = {
  bijeliBrijegLT: "Bijeli Brijeg",
  bijeliBrijegP: "Bijeli Brijeg",
  blagajLT: "Blagaj",
  blagajP: "Blagaj",
  cernicaLT: "Cernica",
  cernicaP: "Cernica",
  cimLT: "Cim",
  cimP: "Cim",
  podhumLT: "Podhum",
  podhumP: "Podhum",
  potociLT: "Potoci",
  potociP: "Potoci",
  zalikLT: "Zalik",
  zalikP: "Zalik",
};

let inputField;

function preload() {
  rawData = loadJSON("/stefan/data/embeddings-full.json");
}

function setup() {
  dataArray = Object.values(rawData).filter((item) => {
    const name = item["Indicator English"];
    return name && name.trim() !== "" && name.trim().toLowerCase() !== "null";
  });
  console.log("DataArrayTest: ", dataArray);
  filteredArray = dataArray;
  embeddings = dataArray.map((d) => d.embedding);

  // Compute first occurrence index per Community for labeling
  const seenCommunityToIndex = {};
  for (let i = 0; i < dataArray.length; i++) {
    const rawCommunity = dataArray[i]["Community"];
    if (!rawCommunity) continue;

    const normalizedCommunity = rawCommunity.replace(/(LT|P)$/i, "");

    if (seenCommunityToIndex[normalizedCommunity] === undefined) {
      seenCommunityToIndex[normalizedCommunity] = i;
      firstCommunityLabelIndices.add(i);
    }
  }

  let canvas = createCanvas(1200, 800);
  canvas.parent("canvasContainer");

  inputField = createInput();
  inputField.parent("panel");
  inputField.input(handleInput);

  appendItems();
}

function draw() {
  background(220);
  fill(30);
  noStroke();

  const margin = 50;
  const cols = 60;
  const spacing = (width - margin * 2) / cols;

  // let drawIndexOffset = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const rawLabel = dataArray[i]["Community"];
    const label = communityNames[rawLabel] || rawLabel;

    // Label only the first dot of each community
    if (firstCommunityLabelIndices.has(i) || i === 0) {
      const { x: labelX, y: labelY } = indexToXY(
        i + getOffsetUpTo(i - 1, spacing),
        cols,
        margin,
        spacing
      );
      noStroke();
      fill(0);
      textSize(10);
      textStyle(BOLD);
      textAlign(LEFT, CENTER);
      text(label, labelX - 3, labelY);
    }

    const adjustedIndex = i + getOffsetUpTo(i, spacing);
    const { x, y } = indexToXY(adjustedIndex, cols, margin, spacing);

    if (filteredArray.length > 0 && dataArray[i] === selectedIndicator) {
      fill(255, 0, 0);
      ellipse(x, y, 10, 10);
    } else if (
      dataArray.length > filteredArray.length &&
      filteredArray.includes(dataArray[i])
    ) {
      fill(0, 30, 255);
      ellipse(x, y, 10, 10);
    } else {
      fill(30);
      ellipse(x, y, 5, 5);
    }
  }

  if (selectedIndicator && closest5.length > 0) {
    const selectedIndex = dataArray.indexOf(selectedIndicator);
    if (selectedIndex !== -1) {
      const sel = indexToXY(
        selectedIndex + getOffsetUpTo(selectedIndex, spacing),
        cols,
        margin,
        spacing
      );

      for (let targetIdx of closest5) {
        const tgt = indexToXY(
          targetIdx + getOffsetUpTo(targetIdx, spacing),
          cols,
          margin,
          spacing
        );

        stroke(0);
        strokeWeight(3);
        line(sel.x, sel.y, tgt.x, tgt.y);
        noFill();
        ellipse(tgt.x, tgt.y, 12, 12);
      }

      noStroke();
      fill(255, 0, 0);
      ellipse(sel.x, sel.y, 12, 12);
    }
  }
}

function handleInput() {
  let query = inputField.value().toLowerCase().trim();

  if (query === "") {
    filteredArray = dataArray;
    selectedIndicator = null;
    closest5 = [];
  } else {
    filteredArray = dataArray.filter((item) => {
      let indicator = item["Indicator English"]?.toLowerCase() || "";
      let regex = new RegExp(`\\b${query}\\b`, "i");
      return regex.test(indicator);
    });

    selectedIndicator = filteredArray.length > 0 ? filteredArray[0] : null;

    if (selectedIndicator) {
      let index = dataArray.indexOf(selectedIndicator);
      closest5 = findFiveClosest(index);

      // console.log("EMOJI: ", selectedIndicator["Indicator English"]);
      // for (let idx of closest5) {
      //   console.log(" →", dataArray[idx]["Indicator English"]);
      // }
    }

    appendItems();
  }
}

function appendItems() {
  const container = select("#contentContainer");
  container.html("");

  for (item of filteredArray) {
    let newDiv = createDiv();
    newDiv.parent(container);
    newDiv.class("item");

    let myIndicator = item["Indicator English"] || "No Title";
    let myCommunity = item["Community"] || "N/A";
    let myDimension = item["Dimension"] || "N/A";

    newDiv.html(`
        <h3>${myIndicator}</h3>
        <p>${myCommunity}</p>
        <p>${myDimension}</p>
        `);
  }
}

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

function findFiveClosest(index) {
  let similarities = [];

  for (let i = 0; i < embeddings.length; i++) {
    if (i === index) continue;
    let sim = cosineSim(embeddings[index], embeddings[i]);
    similarities.push({ index: i, sim: sim });
  }

  similarities.sort((a, b) => b.sim - a.sim);

  return similarities.slice(0, 5).map((d) => d.index);
}

function indexToXY(index, cols, margin, spacing) {
  const x = margin + (index % cols) * spacing;
  const y = margin + floor(index / cols) * spacing;
  return { x, y };
}
// KOMMUNIKATION ZWISCHEN PAGES
// Diese Funktion reagiert auf Nachrichten, die über den WebSocket empfangen werden
window.handleControlFromSocket = function (msg) {
  // Wenn die Nachricht leer ist oder kein Payload enthält, passiert nichts
  if (!msg || !msg.payload) return;

  // Wenn die Aktion im Payload "searchQuery" ist...
  if (msg.payload.action === "searchQuery") {
    // Holt den Suchbegriff aus der Nachricht und wandelt ihn in einen String um
    const query = (msg.payload.query || "").toString();
    const receivedIndicator = msg.payload.selectedIndicator;

    // Prüft, ob das Eingabefeld existiert und ob es eine Funktion namens value hat
    if (inputField && typeof inputField.value === "function") {
      // Setzt den Wert des Eingabefelds auf die empfangene Suchanfrage
      inputField.value(query);

      // Führt handleInput() aus, um z. B. Filter anzuwenden und die Suchanfrage zu senden
      handleInput();
    }
  }

  // Wenn die Aktion im Payload "selectedIndicator" ist...
  if (msg.payload.action === "selectedIndicator") {
    // Setzt den ausgewählten Indikator für die Canvas-Darstellung
    selectedIndicator = msg.payload.indicator;
    console.log("Selected indicator updated:", selectedIndicator);
    // Der Canvas wird automatisch in der draw() Funktion neu gezeichnet
  }
};

function getOffsetUpTo(index, spacing) {
  let offset = 0;
  for (let i = 0; i <= index; i++) {
    if (firstCommunityLabelIndices.has(i) || i === 0) {
      const rawLabel = dataArray[i]["Community"];
      const label = communityNames[rawLabel] || rawLabel;
      const w = textWidth(label);
      offset += ceil((w * 1.1) / spacing); // same padding as dots
    }
  }
  return offset;
}
