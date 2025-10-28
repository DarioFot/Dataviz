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
  SuisseLight = loadFont("../fonts/SuisseIntl-Light.otf");
  SuisseMedium = loadFont("../fonts/SuisseIntl-Medium.otf");
}

function setup() {
  pixelDensity(3);

  dataArray = Object.values(rawData).filter((item) => {
    const name = item["Indicator English"];
    return name && name.trim() !== "" && name.trim().toLowerCase() !== "null";
  });
  console.log("DataArray20.14.21: ", dataArray);
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

  let w = (windowHeight * 3) / 2;
  let canvas = createCanvas(w, windowHeight);
  canvas.parent("canvasContainer");

  inputField = createInput();
  inputField.parent("panel");
  inputField.input(handleInput);

  appendItems();

  console.log("version 24.15.50");
}

function draw() {
  let black = color("#141414ff");
  let blue = color("#329fffff");
  let lightGray = color("#abadd3ff");
  let darkGray = color("#abadd3ff");
  let white = color("#ffffff");

  push();
  translate(-3, -8); //push&pop to translate the whole thing it a bit to the left
  background(black);
  noStroke();

  const margin = 45;
  const cols = 60;
  const spacing = (width - margin * 2) / (cols - 1);

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
      textFont(SuisseMedium);
      noStroke();
      fill(white);
      textSize(15);
      textStyle(BOLD);
      textAlign(LEFT, CENTER);
      text(label.toUpperCase(), labelX - 3, labelY);
      textSize(10);
    }

    const adjustedIndex = i + getOffsetUpTo(i, spacing);
    const { x, y } = indexToXY(adjustedIndex, cols, margin, spacing);

    strokeWeight(2);

    //selectedPoint – pointIncludesQuery – noPointSelected
    if (filteredArray.length > 0 && dataArray[i] === selectedIndicator) {
      fill(21, 138, 242);
      noStroke();
      ellipse(x, y, 17, 17);

      // Add fast pulsing glow effect (20 pulses per cycle)
      const cycle = (frameCount * 0.2) % (TWO_PI * 2);
      let pulseAmount, pulseOpacity;

      if (cycle < PI / 2) {
        pulseAmount = map(cycle, 0, PI / 2, 0, 23);
        pulseOpacity = map(cycle, 0, PI / 2, 0, 0.6);
      } else if (cycle < PI) {
        pulseAmount = map(cycle, PI / 2, PI, 23, 0);
        pulseOpacity = map(cycle, PI / 2, PI, 0.6, 0);
      } else if (cycle < PI * 1.5) {
        pulseAmount = map(cycle, PI, PI * 1.5, 0, 23);
        pulseOpacity = map(cycle, PI, PI * 1.5, 0, 0.6);
      } else {
        pulseAmount = map(cycle, PI * 1.5, TWO_PI, 23, 0);
        pulseOpacity = map(cycle, PI * 1.5, TWO_PI, 0.6, 0);
      }

      drawingContext.shadowBlur = pulseAmount;
      drawingContext.shadowColor = `rgba(19, 138, 242, ${pulseOpacity})`;
      fill(blue);
      ellipse(x, y, 17, 17);
      drawingContext.shadowBlur = 0;
      drawingContext.shadowColor = "transparent";
    } else if (
      dataArray.length > filteredArray.length &&
      filteredArray.includes(dataArray[i])
    ) {
      fill(blue);
      noStroke();
      ellipse(x, y, 8, 8);
    } else {
      noStroke();
      fill(lightGray);
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

        const r = 14 / 2;
        const dx = tgt.x - sel.x;
        const dy = tgt.y - sel.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const endX = tgt.x - (dx / dist) * r;
        const endY = tgt.y - (dy / dist) * r;

        stroke(darkGray);
        strokeWeight(1.5);
        line(sel.x, sel.y, endX, endY);
        strokeWeight(1.5);
        noFill();
        ellipse(tgt.x, tgt.y, r * 2, r * 2);
      }

      // selectedPoint nochmals zeichnen mit Animation
      // Add fast pulsing glow effect (20 pulses per cycle)
      const cycle = (frameCount * 0.2) % (TWO_PI * 2);
      let pulseAmount, pulseOpacity;

      if (cycle < PI / 2) {
        pulseAmount = map(cycle, 0, PI / 2, 0, 15);
        pulseOpacity = map(cycle, 0, PI / 2, 0, 0.6);
      } else if (cycle < PI) {
        pulseAmount = map(cycle, PI / 2, PI, 15, 0);
        pulseOpacity = map(cycle, PI / 2, PI, 0.6, 0);
      } else if (cycle < PI * 1.5) {
        pulseAmount = map(cycle, PI, PI * 1.5, 0, 15);
        pulseOpacity = map(cycle, PI, PI * 1.5, 0, 0.6);
      } else {
        pulseAmount = map(cycle, PI * 1.5, TWO_PI, 15, 0);
        pulseOpacity = map(cycle, PI * 1.5, TWO_PI, 0.6, 0);
      }

      drawingContext.shadowBlur = pulseAmount;
      drawingContext.shadowColor = `rgba(19, 138, 242, ${pulseOpacity})`;
      noStroke();
      fill(21, 138, 242);
      ellipse(sel.x, sel.y, 17, 17);
      drawingContext.shadowBlur = 0;
      drawingContext.shadowColor = "transparent";
    }
  }

  let legendeX = margin;
  let legendeY = height - margin / 2.7;
  let offsetY = 2.5;

  textFont(SuisseLight);
  textSize(15);
  fill(lightGray);
  ellipse(legendeX, legendeY, 5, 5);
  fill(white);
  text("Voices", legendeX + 13, legendeY - offsetY);

  fill("#138af2");
  ellipse(legendeX + spacing * 12, legendeY, 8, 8);
  fill(255);
  text(
    "Voices matching your search",
    legendeX + spacing * 12 + 13,
    legendeY - offsetY
  );

  fill("#138af2");
  ellipse(legendeX + spacing * 5, legendeY, 17, 17);
  fill(255);
  text("Selected voice", legendeX + spacing * 5 + 17, legendeY - offsetY);

  stroke(lightGray);
  strokeWeight(1.5);
  line(
    legendeX + spacing * 23,
    legendeY,
    legendeX + spacing * 26 - 5.5,
    legendeY
  );

  strokeWeight(1.5);
  noFill();
  ellipse(legendeX + spacing * 26, legendeY, 11, 11);
  noStroke();
  fill(255);
  ellipse(legendeX + spacing * 26, legendeY, 5, 5);
  text("Related voices", legendeX + spacing * 26 + 13, legendeY - offsetY);
}

function handleInput() {
  // Only update input field value, don't change selectedIndicator or drawing
  // The drawing is now based on the communicated selectedIndicator from Monitor1
  let query = inputField.value().toLowerCase().trim();

  // Keep filteredArray for display purposes but don't change selectedIndicator
  if (query === "") {
    filteredArray = dataArray;
  } else {
    filteredArray = dataArray.filter((item) => {
      let indicator = item["Indicator English"]?.toLowerCase() || "";
      let regex = new RegExp(`\\b${query}\\b`, "i");
      return regex.test(indicator);
    });
  }

  // --- DEBUG: auto-select first filtered indicator ---
  if (filteredArray.length > 0 && !window.debugDisabled) {
    selectedIndicator = filteredArray[0];
    const index = dataArray.indexOf(selectedIndicator);
    if (index !== -1) {
      closest5 = findFiveClosest(index);
      console.log(
        "Debug auto-selected:",
        selectedIndicator["Indicator English"]
      );
    }
  }

  appendItems();
  pop();
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
    // Finde den Indikator basierend auf dem "Indicator English" Text
    const indicatorEnglish = msg.payload.indicatorEnglish;
    console.log("Received indicatorEnglish:", indicatorEnglish);

    selectedIndicator = dataArray.find(
      (item) => item["Indicator English"] === indicatorEnglish
    );
    console.log("Found selectedIndicator:", selectedIndicator);
    console.log("DataArray length:", dataArray.length);
    console.log("Embeddings length:", embeddings.length);

    // Calculate closest 5 indicators for drawing connections
    if (selectedIndicator) {
      let index = dataArray.indexOf(selectedIndicator);
      console.log("Found index:", index);
      if (index !== -1) {
        closest5 = findFiveClosest(index);
        console.log("Closest 5 calculated:", closest5);
      } else {
        console.log("ERROR: selectedIndicator not found in dataArray");
      }
    } else {
      console.log("ERROR: No indicator found with text:", indicatorEnglish);
    }
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
      offset += ceil((w * 2.3) / spacing); // same padding as dots
    }
  }
  return offset;
}

function windowResized() {
  let w = (windowHeight * 3) / 2;
  resizeCanvas(w, windowHeight);
  spacing = (width - margin * 2) / (cols - 1);
}
