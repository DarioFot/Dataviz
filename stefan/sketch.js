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
    let snippet = getSnippet(fullText, query);
    textAlign(LEFT, CENTER);

    let queryIdx = snippet.toLowerCase().indexOf(query);
    if (queryIdx !== -1) {
      let before = snippet.substring(0, queryIdx);
      let match = snippet.substring(queryIdx, queryIdx + query.length);

      // Measure widths
      let beforeW = textWidth(before);
      let matchW = textWidth(match);

      // Position so query word is centered
      let x = width / 2 - matchW / 2 - beforeW;
      textStyle(NORMAL);
      text(before, x, y);

      textStyle(BOLD);
      text(match, x + beforeW, y);
      textStyle(NORMAL);

      let after = snippet.substring(queryIdx + query.length);
      text(after, x + beforeW + matchW, y);
    } else {
      textAlign(CENTER, CENTER);
      text(snippet, width / 2, y);
    }

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
  const regex = new RegExp(`\\b${escapeRegExp(query)}\\b`, "i");

  filteredArray = dataArray.filter((item) => {
    let indicator = item["Indicator English"] || "";
    return regex.test(indicator);
  });

  // Alphabetisch sortieren nach dem Wort direkt vor dem exakten Treffer
  if (query !== "") {
    filteredArray.sort((a, b) => {
      function getSortKey(text) {
        text = text
          .toLowerCase()
          .replace(/[^\w\s]|_/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const words = text.split(" ");
        const idx = words.indexOf(query);

        if (idx > 0) {
          // normal case: word before exists
          return "0_" + words[idx - 1]; // 0 = higher priority group
        } else if (idx === 0) {
          // query is at start
          return "1_" + query; // 1 = second group
        } else {
          // no match or something weird
          return "2_zzz"; // last group
        }
      }

      return getSortKey(a["Indicator English"] || "").localeCompare(
        getSortKey(b["Indicator English"] || "")
      );
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

// helper: escape user input for regex
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// robust snippet extractor that tolerates punctuation and query-at-end
function getSnippet(text, query) {
  if (!query) return "";
  const q = query.toLowerCase().trim().toLowerCase();
  if (q === "") return "";

  // 1) create a "clean" version of the text where punctuation is replaced by spaces
  //    (this makes matching easier and avoids commas/periods sticking to words)
  let clean = text.replace(/[^\w\s]/g, " ");
  clean = clean.replace(/\s+/g, " ").trim().toLowerCase();

  const qEsc = escapeRegExp(q);

  // 2) try to match "wordBefore query wordAfter"
  let re = new RegExp(`\\b(\\w+)\\s+(${qEsc})\\s+(\\w+)\\b`, "i");
  let m = clean.match(re);
  if (m) {
    return `${m[1]}   ${m[2]}   ${m[3]}`.trim().toLowerCase();
  }

  // 3) try "query wordAfter" (query at start)
  re = new RegExp(`^(${qEsc})\\s+(\\w+)\\b`, "i");
  m = clean.match(re);
  if (m) {
    return `${m[1]}   ${m[2]}`.trim().toLowerCase();
  }

  // 4) try "wordBefore query" (query at end)
  re = new RegExp(`\\b(\\w+)\\s+(${qEsc})$`, "i");
  m = clean.match(re);
  if (m) {
    return `${m[1]}   ${m[2]}`.trim().toLowerCase();
  }

  // 5) fallback: find the query anywhere, and return nearest neighbors if possible
  let idx = clean.toLowerCase().indexOf(q);
  if (idx !== -1) {
    const words = clean.split(" ");
    const wi = words.findIndex((w) => w.toLowerCase() === q);
    if (wi !== -1) {
      const before = wi > 0 ? words[wi - 1] : "";
      const after = wi < words.length - 1 ? words[wi + 1] : "";
      if (before && after)
        return `${before}   ${q}   ${after}`.trim().toLowerCase();
      if (before) return `${before}   ${q}`.trim().toLowerCase();
      if (after) return `${q}   ${after}`.trim().toLowerCase();
      return q;
    }
  }

  return ""; // no useful match
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
