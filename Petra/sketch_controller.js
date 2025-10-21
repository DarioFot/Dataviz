let dataArray = [];
let filteredArray = [];
let rawData;

let inputField;
let selectedIndicator = null;
let activeFocusGroups = new Set(['youth', 'men', 'women']);

let wrapper;
let inner;
let itemHeight = 70; // Basiswert (mindestens)
let buffer = 4;
let lastRenderKey = "";
let lineHeights = new Map(); // speichert Höhe jeder Zeile

// --- load JSON ---
function preload() {
  rawData = loadJSON("/Petra/data/clustered.json");
}

//Testkommentar

// --- setup ---
function setup() {
  noCanvas();
  dataArray = Object.values(rawData);
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
  const hamburger = select('#hamburger');
  const filterMenu = select('#filterMenu');
  hamburger.mousePressed(() => filterMenu.toggleClass('hidden'));

  document.querySelectorAll('#filterMenu input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked) activeFocusGroups.add(cb.value);
        else activeFocusGroups.delete(cb.value);
        applyFilters();
      });
    });

  // scroll handler
  wrapper.elt.addEventListener('scroll', () => {
    renderVisible();
    updateSelectedIndicator();
  });

  // initial render
  applyFilters();
}

// --- input change ---
function onInputChange() {
  // Use shared handler to also emit query over websocket
  handleInput();
}

// --- apply filters ---
function applyFilters() {
  const q = (inputField.value() || "").toLowerCase();

  filteredArray = dataArray.filter(item => {
    let focus = (item["Focus Group"] || "").toLowerCase();
    let indicator = (item["Indicator English"] || "").toLowerCase();
    const matchesFocus = activeFocusGroups.has(focus);

    // Ganze-Wort-Filterung
    const words = indicator.match(/\b\w+\b/g) || [];
    const matchesQuery = q === "" || words.some(w => w.toLowerCase() === q);

    return matchesFocus && matchesQuery;
  });

  wrapper.elt.scrollTop = 0;
  lastRenderKey = "";
  selectedIndicator = filteredArray[0] || null;
  renderVisible();
  showClosestIndicators(selectedIndicator);
  // Send selected indicator to visual for canvas redraw
  sendSelectedToVisual(selectedIndicator);
}

// --- render only visible items ---
function renderVisible() {
  const scrollTop = wrapper.elt.scrollTop;
  const viewH = wrapper.elt.clientHeight;
  const totalItems = filteredArray.length;

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const end = Math.min(totalItems - 1, Math.ceil((scrollTop + viewH) / itemHeight) + buffer);

  const key = `${start}:${end}:${(inputField.value()||"").toLowerCase()}:${filteredArray.length}:${selectedIndicator ? selectedIndicator["Indicator English"] : ""}`;
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
    if (selectedIndicator && selectedIndicator["Indicator English"] === item["Indicator English"]) {
      itemDiv.addClass("selected-item");
    }

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
  inner.style("height", totalHeight + "px");

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

  // --- FALL 1: Keine Suche aktiv → einfacher zentrierter Text ---
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

      const wordSpan = createSpan(wordPart).parent(centerDiv).class("clickable-word");
      wordSpan.style("cursor", "pointer");

      if (punct) createSpan(punct).parent(centerDiv);
      createSpan(" ").parent(centerDiv);

      // Klick auf Wort → Suche starten
      wordSpan.mousePressed(() => {
        inputField.value(wordPart.toLowerCase());
        selectedIndicator = item;
        handleInput(); // This will apply filters AND send to visual
        const idx = filteredArray.indexOf(item);
        if (idx !== -1) {
          setTimeout(() => { wrapper.elt.scrollTop = idx * itemHeight; }, 0);
        }
      });
    }
    return;
  }

  // --- FALL 2: Suche aktiv → bisherige Logik mit drei Teilen ---
  let matchIdx = -1;
  for (let k = 0; k < tokens.length; k++) {
    const cleanWord = tokens[k].replace(/[.,!?;:]+$/, "").toLowerCase();
    if (cleanWord === q) { matchIdx = k; break; }
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

      const wordSpan = createSpan(wordPart).parent(parent).class("clickable-word");
      wordSpan.style("cursor", "pointer");
      if (makeBold) wordSpan.style("font-weight", "bold");

      if (punct) createSpan(punct).parent(parent);
      createSpan(" ").parent(parent);

      wordSpan.mousePressed(() => {
        inputField.value(wordPart.toLowerCase());
        selectedIndicator = item;
        handleInput(); // This will apply filters AND send to visual
        const idx = filteredArray.indexOf(item);
        if (idx !== -1) {
          setTimeout(() => { wrapper.elt.scrollTop = idx * itemHeight; }, 0);
        }
      });
    }
  }

  // Left
  const leftDiv = createDiv().parent(line).class("left-part");
  appendWordSpans(leftDiv, leftTokens, false);

  // Center (fett bei Treffer)
  const centerDiv = createDiv().parent(line).class("center-part");
  if (centerToken) appendWordSpans(centerDiv, [centerToken], true);

  // Right
  const rightDiv = createDiv().parent(line).class("right-part");
  appendWordSpans(rightDiv, rightTokens, false);
}

// --- update selectedIndicator ---
function updateSelectedIndicator() {
  const scrollTop = wrapper.elt.scrollTop;
  let idx = 0;
  let cumulative = 0;
  for (let i = 0; i < filteredArray.length; i++) {
    const h = lineHeights.get(i) || itemHeight;
    if (scrollTop < cumulative + h) { idx = i; break; }
    cumulative += h;
  }

  const newSelected = filteredArray[idx] || null;
  if (!selectedIndicator || (newSelected && selectedIndicator["Indicator English"] !== newSelected["Indicator English"])) {
    selectedIndicator = newSelected;
    showClosestIndicators(selectedIndicator);
    // Send selected indicator to visual for canvas redraw
    sendSelectedToVisual(selectedIndicator);
  }

  const children = inner.elt.children;
  for (let i = 0; i < children.length; i++) children[i].classList.remove("selected-item");
  const visibleIdx = idx - Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  if (children[visibleIdx]) children[visibleIdx].classList.add("selected-item");
}

// --- cosine similarity ---
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i]; }
  return dot / (Math.sqrt(ma)*Math.sqrt(mb));
}

// --- show closest indicators ---
function showClosestIndicators(curr) {
  const container = select("#contentContainer");
  container.html("");
  if (!curr || !curr.embedding) return;

  let sims = dataArray.map(it => ({it, sim: cosineSim(curr.embedding, it.embedding || [])}));
  sims.sort((x,y) => y.sim - x.sim);
  let closest = sims.filter(s => s.it["Indicator English"] !== curr["Indicator English"]).slice(0,5);

  for (let s of closest) {
    const item = s.it;
    let d = createDiv().parent(container).class("item");
    let title = item["Indicator English"] || "No Title";
    let wordsHtml = title.split(/\s+/).map(w => `<span class="clickable-word" data-word="${w}" data-id="${item["Indicator English"]}">${w}</span>`).join(" ");
    d.html(`<h3>${wordsHtml}</h3>`);
    showDetails(curr);
  }

  document.querySelectorAll("#contentContainer .clickable-word").forEach(el => {
    el.onclick = () => {
      let w = el.getAttribute("data-word") || "";
      const id = el.getAttribute("data-id");
      w = w.replace(/[.,!?;:]+$/, "").toLowerCase(); // Satzzeichen entfernen
      inputField.value(w);
      handleInput(); // This will apply filters AND send to visual
      const found = dataArray.find(d => d["Indicator English"] === id);
      if (found) {
        selectedIndicator = found;
        const idx = filteredArray.indexOf(found);
        if (idx !== -1) wrapper.elt.scrollTop = idx * itemHeight;
      }
    };
  });
}

function constrain(v, a, b) { return Math.min(Math.max(v, a), b); }
function windowResized() { wrapper.style("height", "600px"); }

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
  const community = indicator["Community"] || "N/A";
  const dim1 = indicator["Dimension 1"] || "";
  const dim2 = indicator["Dimension 2"] || "";

  // HTML-Struktur aufbauen (ohne CSS zu ändern!)
  const html = `
    <div id="detailsContent">
      <div class="detail-block">
        <div class="detail-title">Speaker</div>
        <div class="detail-value">${speaker}</div>
      </div>
      <div class="detail-block">
        <div class="detail-title">Community</div>
        <div class="detail-value">${community}</div>
      </div>
      <div class="detail-block">
        <div class="detail-title">Categories</div>
        <div class="detail-value">${[dim1, dim2].filter(Boolean).join(" & ") || "N/A"}</div>
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

// Send selected indicator to visual for canvas redraw
function sendSelectedToVisual(indicator) {
  try {
    if (window.socket && indicator) {
      window.socket.emit("control", {
        targetRoom: "visual",
        payload: {
          action: "selectedIndicator",
          indicator: indicator
        },
      });
    }
  } catch (e) {
    // Fehler werden ignoriert
  }
}