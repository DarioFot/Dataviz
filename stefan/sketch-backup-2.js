let dataArray = [];
let filteredArray = [];

let rawData;
let inputField;
let scrollY = 0;
let targetScrollY = 0;

function preload() {
  rawData = loadJSON("data/combined-data.json");
}

function setup() {
  dataArray = Object.values(rawData);
  filteredArray = dataArray;

  let canvas = createCanvas(800, 600);
  canvas.parent("canvasContainer");

  inputField = createInput();
  inputField.parent("panel");
  inputField.input(handleInput);

  textFont("Arial");
  appendItems();
}

function draw() {
  background(255);
  textSize(14);
  fill(0);

  // Scrollen
  scrollY = lerp(scrollY, targetScrollY, 0.2);
  scrollY = constrain(scrollY, 0, max(0, filteredArray.length * 25 - height));

  push();
  translate(0, -scrollY); // alles wird nach oben/unten verschoben

  let query = inputField.value().toLowerCase();
  let y = 30;

  for (let item of filteredArray) {
    let fullText = item["Indicator English"] || "No Title";
    drawCenteredText(fullText, query, width / 2, y, width - 60);
    y += 25;
  }

  pop();
}

// Scroll per Mausrad
function mouseWheel(event) {
  targetScrollY += event.delta;
  targetScrollY = constrain(
    targetScrollY,
    0,
    max(0, filteredArray.length * 25 - height)
  );
  return false; // verhindert Browser-Scroll
}

function handleInput() {
  let query = inputField.value().toLowerCase().trim();

  // Nur ganze Worttreffer
  const regex = new RegExp(`\\b${query}\\b`, "i");

  filteredArray = dataArray.filter((item) => {
    let indicator = item["Indicator English"] || "";
    return regex.test(indicator);
  });

  // Alphabetisch sortieren nach dem Wort direkt vor dem exakten Treffer
  if (query !== "") {
    filteredArray.sort((a, b) => {
      let aText = a["Indicator English"] || "";
      let bText = b["Indicator English"] || "";

      function getWordBefore(text) {
        let match = text.match(new RegExp(`(\\b\\w+)\\s+${query}\\b`, "i"));
        if (match) {
          return match[1].toLowerCase(); // Wort vor dem Treffer
        }

        // Kein Wort davor → Wort selbst (z. B. „Water availability“)
        if (text.toLowerCase().startsWith(query)) {
          return query;
        }

        return "zzz"; // Kein Treffer oder unpassend → ans Ende
      }

      let aKey = getWordBefore(aText);
      let bKey = getWordBefore(bText);

      return aKey.localeCompare(bKey);
    });
  }

  appendItems();

  scrollY = 0;
  targetScrollY = 0;
}

// Zeichnet einen Satz so, dass das Suchwort zentriert in der Mitte des Canvas steht
function drawCenteredText(fullText, query, centerX, y, maxWidth) {
  let lowerText = fullText.toLowerCase();
  let idx = lowerText.indexOf(query);

  if (idx === -1 || query === "") {
    // Kein Treffer, normalen Text kürzen
    let trimmed = trimText(fullText, maxWidth);
    textAlign(CENTER, CENTER);
    textStyle(NORMAL);
    text(trimmed, centerX, y);
    return;
  }

  // Teile den Text
  let before = fullText.substring(0, idx);
  let match = fullText.substring(idx, idx + query.length);
  let after = fullText.substring(idx + query.length);

  // Textbreiten messen
  textStyle(NORMAL);
  let beforeWidth = textWidth(before);
  let afterWidth = textWidth(after);
  textStyle(BOLD);
  let matchWidth = textWidth(match);
  textStyle(NORMAL);

  // Wieviel Platz links/rechts maximal
  let halfWidth = maxWidth / 2;
  let leftSpace = halfWidth - matchWidth / 2;
  let rightSpace = halfWidth - matchWidth / 2;

  // Links abschneiden falls nötig
  let leftText = before;
  while (textWidth(leftText) > leftSpace && leftText.length > 0) {
    leftText = leftText.substring(leftText.indexOf(" ") + 1);
  }
  if (leftText !== before) leftText = "... " + leftText;

  // Rechts abschneiden falls nötig
  let rightText = after;
  while (textWidth(rightText) > rightSpace && rightText.length > 0) {
    rightText = rightText.substring(0, rightText.lastIndexOf(" "));
  }
  if (rightText !== after) rightText = rightText + " ...";

  // Ganze Linie zusammensetzen
  let fullLine = leftText + match + rightText;

  // Position für linken Textteil berechnen
  let leftX = centerX - textWidth(match) / 2 - textWidth(leftText);

  // Zeichnen
  textAlign(LEFT, CENTER);

  // Linker Teil
  textStyle(NORMAL);
  text(leftText, leftX, y);

  // Suchwort fett
  let matchX = leftX + textWidth(leftText);
  textStyle(BOLD);
  text(match, matchX, y);

  // Rechter Teil
  textStyle(NORMAL);
  let rightX = matchX + textWidth(match);
  text(rightText, rightX, y);
}

// Kürzt Text, wenn kein Suchwort drin ist
function trimText(txt, maxWidth) {
  if (textWidth(txt) <= maxWidth) return txt;
  while (textWidth(txt + "...") > maxWidth && txt.length > 0) {
    txt = txt.substring(0, txt.length - 1);
  }
  return txt + "...";
}

// --- HTML-Anzeige unter Canvas ---
function appendItems() {
  const container = select("#contentContainer");
  container.html("");

  for (item of filteredArray) {
    let newDiv = createDiv();
    newDiv.parent(container);
    newDiv.class("item");

    newDiv.html(`
      <h3>${item["Indicator English"] || "No Title"}</h3>
      <p>Community: ${item["Community"] || "N/A"}</p>
      <p>Dimension: ${item["Dimension 1"] || "N/A"}</p>
    `);
  }
}
