let rawData;
let dataArray = [];
let filteredArray;
let embeddings = [];
let closest5 = [];
let selectedIndicator = null;

let inputField;

function preload() {
  rawData = loadJSON("data/embeddings-full.json");
}

function setup() {
  dataArray = Object.values(rawData).filter((item) => {
    const name = item["Indicator English"];
    return name && name.trim() !== "" && name.trim().toLowerCase() !== "null";
  });
  console.log("DataArray: ", dataArray);
  filteredArray = dataArray;
  embeddings = dataArray.map((d) => d.embedding);

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

  for (let i = 0; i < dataArray.length; i++) {
    const { x, y } = indexToXY(i, cols, margin, spacing);

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
      const sel = indexToXY(selectedIndex, cols, margin, spacing);

      for (let targetIdx of closest5) {
        const tgt = indexToXY(targetIdx, cols, margin, spacing);

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

      console.log("EMOJI: ", selectedIndicator["Indicator English"]);
      for (let idx of closest5) {
        console.log(" →", dataArray[idx]["Indicator English"]);
      }
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
