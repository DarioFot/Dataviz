let dataArray = [];
let filteredArray = [];
let rawData;

let inputField;
let selectedIndicator = null;
let activeFocusGroups = new Set(["youth", "men", "women"]);

let wrapper;
let inner;
let itemHeight = 70; // Basiswert (mindestens)
let buffer = 4;
let lastRenderKey = "";
let lineHeights = new Map(); // speichert Höhe jeder Zeile

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

// --- load JSON ---
function preload() {
  rawData = loadJSON("/stefan/data/embeddings-full.json");
}

//Testkommentar

// --- setup ---
function setup() {
  noCanvas();
  // Filter data like in Visual to ensure same structure
  dataArray = Object.values(rawData).filter((item) => {
    const name = item["Indicator English"];
    return name && name.trim() !== "" && name.trim().toLowerCase() !== "null";
  });
  filteredArray = dataArray.slice();

  // input
  inputField = createInput();
  inputField.parent("panel");
  inputField.input(onInputChange);

  // outer wrapper
  wrapper = createDiv().parent("canvasContainer");
  wrapper.id("scrollWrapper");
  wrapper.style("height", "600px");
  wrapper.style("overflow-y", "auto");
  wrapper.style("position", "relative");

  // inner virtual container
  inner = createDiv().parent(wrapper);
  inner.id("innerContainer");
  inner.style("position", "relative");
  inner.style("width", "100%");

  // filter menu handlers
  const hamburger = select("#hamburger");
  const filterMenu = select("#filterMenu");
  hamburger.mousePressed(() => filterMenu.toggleClass("hidden"));

  document
    .querySelectorAll('#filterMenu input[type="checkbox"]')
    .forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) activeFocusGroups.add(cb.value);
        else activeFocusGroups.delete(cb.value);
        applyFilters();
      });
    });

  // scroll handler
  wrapper.elt.addEventListener("scroll", () => {
    renderVisible();
    updateSelectedIndicator();
  });

  // initial render
  applyFilters();

  console.log("version 24.10.14");
}

// --- input change ---
function onInputChange() {
  // Use shared handler to also emit query over websocket
  handleInput();
}

// --- apply filters ---
function applyFilters() {
  const q = (inputField.value() || "").toLowerCase();

  filteredArray = dataArray.filter((item) => {
    let focus = (item["Focus Group"] || "").toLowerCase();
    let indicator = (item["Indicator English"] || "").toLowerCase();
    const matchesFocus = activeFocusGroups.has(focus);

    // Ganze-Wort-Filterung
    const words = indicator.match(/\b\w+\b/g) || [];
    const matchesQuery = q === "" || words.some((w) => w.toLowerCase() === q);

    return matchesFocus && matchesQuery;
  });

  // If a selectedIndicator exists and is in filteredArray, move it to top
  if (selectedIndicator) {
    const idx = filteredArray.indexOf(selectedIndicator);
    if (idx > -1) {
      filteredArray.splice(idx, 1);
      filteredArray.unshift(selectedIndicator);
    }
  } else {
    selectedIndicator = filteredArray[0] || null;
  }

  wrapper.elt.scrollTop = 0;
  lastRenderKey = "";
  selectedIndicator = filteredArray[0] || null; //change to 1?
  renderVisible();
  showClosestIndicators(selectedIndicator);
  // Send selected indicator to visual for canvas drawing
  sendSelectedToVisual(selectedIndicator);
}

// --- render only visible items ---
function renderVisible() {
  const scrollTop = wrapper.elt.scrollTop;
  const viewH = wrapper.elt.clientHeight;
  const totalItems = filteredArray.length;

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const end = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + viewH) / itemHeight) + buffer
  );

  const key = `${start}:${end}:${(inputField.value() || "").toLowerCase()}:${
    filteredArray.length
  }:${selectedIndicator ? selectedIndicator["Indicator English"] : ""}`;
  if (key === lastRenderKey) return;
  lastRenderKey = key;

  inner.html("");
  lineHeights.clear();

  const q = (inputField.value() || "").toLowerCase();

  // Erst bauen, um Höhe zu messen
  for (let i = start; i <= end; i++) {
    const item = filteredArray[i];
    const text = item["Indicator English"] || "No Title";

    const itemDiv = createDiv().parent(inner);
    itemDiv.class("scroll-item");
    if (
      selectedIndicator &&
      selectedIndicator["Indicator English"] === item["Indicator English"]
    ) {
      itemDiv.addClass("selected-item");
    }

    // if (item.id === "placeholder" || item.visible === false) continue;

    buildThreePart(itemDiv, text, q, item);

    // Nach DOM-Erstellung Höhe messen
    const h = Math.max(itemDiv.elt.scrollHeight, itemHeight);
    lineHeights.set(i, h);
  }

  // Gesamthöhe berechnen
  let totalHeight = 0;
  for (let i = 0; i < totalItems; i++) {
    totalHeight += lineHeights.get(i) || itemHeight;
  }

  totalHeight += itemHeight * 7;

  const minHeight = wrapper.elt.clientHeight + itemHeight * buffer;
  inner.style("height", Math.max(totalHeight, minHeight) + "px");

  const realTotalHeight = totalHeight - itemHeight * 7;
  const lastItemHeight = lineHeights.get(totalItems - 1) || itemHeight;
  const maxScrollTop = realTotalHeight - lastItemHeight;
  wrapper.elt.scrollTop = constrain(wrapper.elt.scrollTop, 0, maxScrollTop);

  // Positionierung der sichtbaren Zeilen
  let currentY = 0;
  for (let i = 0; i < totalItems; i++) {
    const h = lineHeights.get(i) || itemHeight;
    if (i >= start && i <= end) {
      const div = inner.elt.children[i - start];
      div.style.top = currentY + "px";
      div.style.height = h + "px";
    }
    currentY += h;
  }
}

// --- build text line (angepasst: zentriert, wenn keine Suche aktiv) ---
function buildThreePart(container, fullText, query, item) {
  container.html("");
  const q = (query || "").trim().toLowerCase();

  const tokens = fullText.match(/\b\w+\b[.,!?;:]?|\S+/g) || [];

  // === FALL 1: Keine Suche aktiv → zentrierter Text ohne Punkte ===
  if (q === "") {
    const line = createDiv().parent(container);
    line.class("line-container");
    line.style("grid-template-columns", "1fr");
    line.style("justify-items", "center");

    const centerDiv = createDiv().parent(line).class("center-part");
    centerDiv.style("text-align", "center");

    for (const tok of tokens) {
      const m = tok.match(/^(\w+)([.,!?;:]*)$/);
      const wordPart = m ? m[1] : tok;
      const punct = m ? m[2] : "";

      const wordSpan = createSpan(wordPart)
        .parent(centerDiv)
        .class("clickable-word");
      wordSpan.style("cursor", "pointer");

      if (punct) createSpan(punct).parent(centerDiv);
      createSpan(" ").parent(centerDiv);

      // Klick → Suche starten
      wordSpan.mousePressed(() => {
        inputField.value(wordPart.toLowerCase());
        selectedIndicator = item;

        moveItemToTopInDataArray(item);
        handleInput(); // Filter neu anwenden
        setTimeout(() => {
          wrapper.elt.scrollTop = 0;
        }, 0);
      });
    }
    return;
  }

  // === FALL 2: Suche aktiv → Dreiteiliges Layout MIT Punkten ===
  let matchIdx = -1;
  for (let k = 0; k < tokens.length; k++) {
    const cleanWord = tokens[k].replace(/[.,!?;:]+$/, "").toLowerCase();
    if (cleanWord === q) {
      matchIdx = k;
      break;
    }
  }

  let leftTokens, centerToken, rightTokens;
  if (matchIdx >= 0) {
    leftTokens = tokens.slice(0, matchIdx);
    centerToken = tokens[matchIdx];
    rightTokens = tokens.slice(matchIdx + 1);
  } else {
    leftTokens = tokens;
    centerToken = null;
    rightTokens = [];
  }

  const line = createDiv().parent(container);
  line.class("line-container");

  function appendWordSpans(parent, tokenArray, makeBold = false) {
    for (const tok of tokenArray) {
      const m = tok.match(/^(\w+)([.,!?;:]*)$/);
      const wordPart = m ? m[1] : tok;
      const punct = m ? m[2] : "";

      const wordSpan = createSpan(wordPart)
        .parent(parent)
        .class("clickable-word");
      wordSpan.style("cursor", "pointer");
      if (makeBold) wordSpan.style("font-weight", "bold");

      if (punct) createSpan(punct).parent(parent);
      createSpan(" ").parent(parent);

      wordSpan.mousePressed(() => {
        inputField.value(wordPart.toLowerCase());
        selectedIndicator = item;

        moveItemToTopInDataArray(item);
        handleInput(); // Filter neu anwenden
        setTimeout(() => {
          wrapper.elt.scrollTop = 0;
        }, 0);
      });
    }
  }

  // --- LEFT PART ---
  const leftDiv = createDiv().parent(line).class("left-part");

  // 🔵 Punkt links
  const leftDot = createDiv().parent(leftDiv);
  leftDot.class("blue-dot left-dot");

  appendWordSpans(leftDiv, leftTokens, false);

  // --- CENTER PART ---
  const centerDiv = createDiv().parent(line).class("center-part");
  if (centerToken) appendWordSpans(centerDiv, [centerToken], true);

  // --- RIGHT PART ---
  const rightDiv = createDiv().parent(line).class("right-part");
  appendWordSpans(rightDiv, rightTokens, false);

  // 🔵 Punkt rechts
  const rightDot = createDiv().parent(rightDiv);
  rightDot.class("blue-dot right-dot");
}

// --- update selectedIndicator ---
function updateSelectedIndicator() {
  const scrollTop = wrapper.elt.scrollTop;
  let idx = 0;
  let cumulative = 0;
  for (let i = 0; i < filteredArray.length; i++) {
    const h = lineHeights.get(i) || itemHeight;
    if (scrollTop < cumulative + h * 0.05) {
      idx = i;
      break;
    }
    cumulative += h;
  }

  // if (idx === 0 && filteredArray[0]?.id === "placeholder") idx = 1;

  const newSelected = filteredArray[idx] || null;
  if (
    !selectedIndicator ||
    (newSelected &&
      selectedIndicator["Indicator English"] !==
        newSelected["Indicator English"])
  ) {
    selectedIndicator = newSelected;
    showClosestIndicators(selectedIndicator);
    // Send selected indicator to visual for canvas drawing
    sendSelectedToVisual(selectedIndicator);
  }

  const children = inner.elt.children;
  for (let i = 0; i < children.length; i++)
    children[i].classList.remove("selected-item");
  const visibleIdx =
    idx - Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  if (children[visibleIdx]) children[visibleIdx].classList.add("selected-item");
}

// --- cosine similarity ---
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    ma = 0,
    mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

// --- show closest indicators ---
function showClosestIndicators(curr) {
  const container = select("#contentContainer");
  container.html("");

  createElement("h2", "RELATED VOICES").parent(container);

  const topRow = createDiv().parent(container).addClass("row top-row");
  const bottomRow = createDiv().parent(container).addClass("row bottom-row");

  if (!curr || !curr.embedding) return;

  let sims = dataArray.map((it) => ({
    it,
    sim: cosineSim(curr.embedding, it.embedding || []),
  }));
  sims.sort((x, y) => y.sim - x.sim);
  let closest = sims
    .filter((s) => s.it["Indicator English"] !== curr["Indicator English"])
    .slice(0, 5);

  let counter = 1;
  for (let s of closest) {
    const item = s.it;
    let parentRow = closest.indexOf(s) % 2 === 0 ? topRow : bottomRow;
    let d = createDiv().parent(parentRow).class("item");

    const title = item["Indicator English"] || "No Title";

    let wordsHtml =
      `${counter} – ` +
      title
        .split(/\s+/)
        .map(
          (w) =>
            `<span class="clickable-word" data-word="${w}" data-id="${item["Indicator English"]}">${w}</span>`
        )
        .join(" ");

    const simPercent = (s.sim * 100).toFixed(1) + "%";

    d.html(
      `<h3>${wordsHtml} <span class="sim-score">${simPercent}</span></h3>`
    );

    showDetails(curr);

    counter++;
  }

  document
    .querySelectorAll("#contentContainer .clickable-word")
    .forEach((el) => {
      el.onclick = () => {
        let w = el.getAttribute("data-word") || "";
        const id = el.getAttribute("data-id");
        w = w.replace(/[.,!?;:]+$/, "").toLowerCase(); // Satzzeichen entfernen

        const found = dataArray.find((d) => d["Indicator English"] === id);
        if (found) {
          // move in canonical array then reapply filters
          moveItemToTopInDataArray(found);

          inputField.value(w);
          handleInput(); // This will apply filters AND send to visual

          selectedIndicator = found;
          setTimeout(() => {
            wrapper.elt.scrollTop = 0;
          }, 0);
        }
      };
    });
}

function constrain(v, a, b) {
  return Math.min(Math.max(v, a), b);
}
function windowResized() {
  wrapper.style("height", "600px");
}

function showDetails(indicator) {
  const container = select("#detailsContent");
  if (!container) return;
  container.html(""); // leeren, bevor neu gefüllt wird

  if (!indicator) {
    container.html("Select an entry to see more information here.");
    return;
  }

  // Werte aus dem JSON holen
  const speaker = indicator["Focus Group"] || "N/A";
  const dim1 = indicator["Subcat 1 name"] || "";
  const dim2 = indicator["Subcat 2 name"] || "";

  const rawCommunity = indicator["Community"] || "N/A";
  const community = communityNames[rawCommunity] || "N/A";

  // HTML-Struktur aufbauen (ohne CSS zu ändern!)
  const html = `
    <div id="detailsContent">
      <div class="detail-block">
        <div class="detail-title">Speaker</div>
        <div class="detail-value">${speaker}</div>
      </div>      <div class="detail-block">
        <div class="detail-title">Categories</div>
        <div class="detail-value">${
          [dim1, dim2].filter(Boolean).join(" & ") || "N/A"
        }</div>
      </div>
      <div class="detail-block">
        <div class="detail-title">Community</div>
        <div class="detail-value">${community}</div>
      </div>

    </div>
  `;

  container.html(html);
}

// KOMMUNIKATION ZWISCHEN PAGES
function handleInput() {
  // Wendet Filter auf die Eingabe an (z. B. zur Anzeige oder Suche)
  applyFilters();

  // Versucht, eine Live-Anfrage über WebSocket an den „visual"-Raum zu senden
  try {
    // Prüft, ob eine WebSocket-Verbindung existiert
    if (window.socket) {
      // Holt den Wert aus dem Eingabefeld, wandelt ihn in Kleinbuchstaben um
      const query = (inputField.value() || "").toLowerCase();

      // Sendet eine Nachricht über den Socket mit dem Suchbegriff
      window.socket.emit("control", {
        targetRoom: "visual", // Zielraum für die Nachricht
        payload: {
          action: "searchQuery", // Aktion: Suchanfrage senden
          query, // Der eigentliche Suchbegriff
        },
      });
    }
  } catch (e) {
    // Fehler werden ignoriert (z. B. wenn keine Verbindung besteht)
  }
}

// Send selected indicator to visual for canvas drawing
function sendSelectedToVisual(indicator) {
  try {
    if (window.socket && indicator) {
      const indicatorEnglish = indicator["Indicator English"];
      console.log("Sending selectedIndicator to visual:", indicatorEnglish);
      window.socket.emit("control", {
        targetRoom: "visual",
        payload: {
          action: "selectedIndicator",
          indicatorEnglish: indicatorEnglish,
        },
      });
    } else {
      console.log(
        "Cannot send - socket:",
        !!window.socket,
        "indicator:",
        !!indicator
      );
    }
  } catch (e) {
    console.log("Error sending selectedIndicator:", e);
  }
}

function constrain(v, a, b) {
  return Math.min(Math.max(v, a), b);
}

function moveItemToTopInDataArray(item) {
  if (!item) return false;
  const idx = dataArray.indexOf(item);
  if (idx > -1) {
    // remove and unshift to the front
    dataArray.splice(idx, 1);
    dataArray.unshift(item);
    return true;
  }
  return false;
}
