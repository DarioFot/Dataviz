let dataArray = [];
let filteredArray = [];
let rawData;

let inputField;
let selectedIndicator = null;
let activeFocusGroups = new Set(["youth", "men", "women"]);

let wrapper;
let inner;
let itemHeight = 60; // Basiswert (mindestens)
let buffer = 4;
let lastRenderKey = "";
let lineHeights = new Map(); // speichert Höhe jeder Zeile
let scrollTimeout = null; // timeout for delayed detail updates while scrolling

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

  // make sure it's a text field and has your custom placeholder
  inputField.attribute("type", "text");
  inputField.attribute(
    "placeholder",
    "your word (e.g. respect / together / socialize)"
  );

  // connect to your existing input handler
  inputField.input(onInputChange);

  // Titel mit Info-Button (korrekte Positionierung)
  const canvasTitle = createElement("h2", "Voices matching your search");
  canvasTitle.parent("canvasContainer");

  // Info-Button direkt INS h2 hängen (nicht als eigenes Div)
  const infoVoices = createSpan("")
    .addClass("info-icon")
    .attribute(
      "data-info",
      "In the scrolling area, you can explore all statements from across Mostar that contain the same search term (only exact matches). Click on individual words to navigate through different “signs of peace” and see how people describe peace in their own ways."
    );
  infoVoices.parent(canvasTitle); // ✅ direkt im H2 platzieren
  createSpan("i").addClass("info-letter").parent(infoVoices);

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

  console.log("version 24.15.50");
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
    const line = createDiv().parent(container).class("ohneContainer");
    const containerOhne = createDiv().parent(line).class("ohneContainer");
    createDiv().parent(containerOhne).class("blue-dot"); 
    const centerDiv = createDiv().parent(containerOhne).class("center-part");
    centerDiv.style("text-align", "center");
    createDiv().parent(containerOhne).class("blue-dot");

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

        // Show details immediately when clicking
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
          scrollTimeout = null;
        }
        showDetails(item);
      });
    }
    return;
  }

  // === FALL 2: Suche aktiv → Fünf Spalten (Punkt – links – Mitte – rechts – Punkt) ===
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

  // Hilfsfunktion für Wörter
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
        handleInput();
        setTimeout(() => {
          wrapper.elt.scrollTop = 0;
        }, 0);

        // Show details immediately when clicking
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
          scrollTimeout = null;
        }
        showDetails(item);
      });
    }
  }

  //Left Part
  /*// --- 1️⃣ Punkt ganz links ---
  const dotLeft = createDiv().parent(line);
  dotLeft.class("blue-dot left-dot");*/

  /*
  // --- 2️⃣ Linker Satzteil ---
  const leftDiv = createDiv().parent(line).class("left-part");
  // 🔵 Punkt links
  const leftDot = createDiv().parent(leftDiv);
  leftDot.class("blue-dot left-dot");
  leftDiv.style("text-align", "right");
  appendWordSpans(leftDiv, leftTokens, false);*/

  // --- 2️⃣ Linker Satzteil ---
  const leftDivWrapper = createDiv().parent(line).class("left-part-wrapper");
  createDiv().parent(leftDivWrapper).class("blue-dot");
  const leftDiv = createDiv().parent(leftDivWrapper).class("left-part");
  leftDiv.style("text-align", "right");
  appendWordSpans(leftDiv, leftTokens, false);

  // --- CENTER PART ---
  // --- 3️⃣ Suchwort zentriert ---
  const centerDiv = createDiv().parent(line).class("center-part");
  //centerDiv.style("text-align", "center");
  if (centerToken) appendWordSpans(centerDiv, [centerToken], true);

  // --- 4️⃣ Rechter Satzteil ---

  // 🔵 Punkt rechts
  const rightDivWrapper = createDiv().parent(line).class("right-part-wrapper");
  const rightDiv = createDiv().parent(rightDivWrapper).class("right-part");
  appendWordSpans(rightDiv, rightTokens, false);
  createDiv().parent(rightDivWrapper).class("blue-dot");
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

    // Clear only the detail values while scrolling (keep space with non-breaking space)
    const detailValues = document.querySelectorAll(".detail-value");
    detailValues.forEach((el) => {
      el.textContent = "\u00A0"; // Non-breaking space to maintain height
    });

    // Clear row content while scrolling (same as detail values)
    const rows = document.querySelectorAll(".row");
    rows.forEach((row) => {
      row.innerHTML = "";
    });

    // Clear any existing timeout and delay the detail update
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
      showDetails(selectedIndicator);
      showClosestIndicators(selectedIndicator); // Also show rows after delay
    }, 300); // 0.3 second delay after scrolling stops
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

  // Titel mit Info-Button (korrekte Positionierung)
  const relatedTitle = createElement(
    "h2",
    "Related voices ranked by similarity score"
  );
  relatedTitle.parent(container);

  const infoRelated = createSpan("")
    .addClass("info-icon")
    .attribute(
      "data-info",
      "Below are statements from the dataset most similar in meaning to the one you selected. They may not contain the same keyword. Similarity was determined using a Large Language Model (LLM) and is shown as a percentage. The higher the percentage, the more similar the statement is in meaning to the selected one."
    );
  infoRelated.parent(relatedTitle); // ✅ Icon INS H2 hängen
  createSpan("i").addClass("info-letter").parent(infoRelated);

  // const topRow = createDiv().parent(container).addClass("row top-row");
  // const bottomRow = createDiv().parent(container).addClass("row bottom-row");
  const contentRow = createDiv().parent(container).addClass("row content-row");

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
    // const parentRow = s < 3 ? topRow : bottomRow;
    let d = createDiv().parent(contentRow).class("item");

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

    counter++;
  }

  // Only show details immediately if not scrolling (when timeout was triggered)
  if (!scrollTimeout) {
    showDetails(curr);
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

          // Show details immediately when clicking
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
          }
          showDetails(found);
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

  // HTML-Struktur mit Info-Buttons
  const html = `
    <div id="detailsContent">
      <div class="detail-block">
        <div class="detail-title">
          Speaker
          <div class="info-icon" data-info="Indicates which focus group the statement originates from — Women, Men or Youth."><span class="info-letter">i</span></div>
        </div>
        <div class="detail-value">${speaker}</div>
      </div>

      <div class="detail-block">
        <div class="detail-title">
          Categories
          <div class="info-icon" data-info="Indicates the thematic area(s) this statement belongs to."><span class="info-letter">i</span></div>
        </div>
        <div class="detail-value">${
          [dim1, dim2].filter(Boolean).join(" & ") || "N/A"
        }</div>
      </div>

      <div class="detail-block">
        <div class="detail-title">
          Community
          <div class="info-icon" data-info="Neighborhood in Mostar where the statement originates."><span class="info-letter">i</span></div>
        </div>
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
