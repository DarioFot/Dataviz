let dataArray = [];
let filteredArray = [];
let selectedIndicator = null;

let activeFocusGroups = new Set(["youth", "men", "women"]); // Standard: alle aktiv
let inputField;
let listContainer;
let itemHeight = 70;

// --- JSON-Daten laden ---
function preload() {
  rawData = loadJSON("/Petra/data/clustered.json");
}

// --- SETUP ---
function setup() {
  dataArray = Object.values(rawData);
  filteredArray = dataArray;

  // Input-Feld
  inputField = createInput();
  inputField.parent("panel");
  inputField.input(handleInput);

  // Scrollbarer Container
  listContainer = createDiv();
  listContainer.parent("canvasContainer");
  listContainer.style("height", "600px");
  listContainer.style("overflow-y", "auto");

  listContainer.elt.addEventListener("scroll", () => {
    updateSelectedIndicator();
  });

  // Hamburger-Menü
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

  renderList();
}

// --- RENDER LIST ITEMS ---
function renderList() {
  listContainer.html(""); // alte Items löschen
  let query = inputField.value().toLowerCase();

  filteredArray.forEach((item) => {
    let fullText = item["Indicator English"] || "No Title";

    // Hauptcontainer
    let itemDiv = createDiv().parent(listContainer);
    itemDiv.class("scroll-item");
    itemDiv.style("height", itemHeight + "px");
    itemDiv.style("line-height", itemHeight + "px");

    // --- Wörter splitten und anzeigen ---
    fullText.split(/\s+/).forEach((w) => {
      let spanDiv = createSpan(w + " ").parent(itemDiv);
      spanDiv.class("clickable-word");
      spanDiv.style("margin", "0 2px");
      spanDiv.style("white-space", "nowrap");

      // Fett-Markierung für Suchwort
      if (query.length >= 3 && w.toLowerCase().includes(query)) {
        spanDiv.style("font-weight", "bold");
      } else {
        spanDiv.style("font-weight", "normal");
      }

      // Klick auf Wort
      spanDiv.mousePressed(() => {
        inputField.value(w.toLowerCase());
        handleInput();

        // selectedIndicator setzen
        let found = dataArray.find((d) => d["Indicator English"] === fullText);
        if (found) {
          selectedIndicator = found;
          let index = filteredArray.indexOf(found);
          if (index !== -1) listContainer.elt.scrollTop = index * itemHeight;
        }
      });
    });
  });

  updateSelectedIndicator();
}

// --- UPDATE selectedIndicator UND HIGHLIGHT ---
function updateSelectedIndicator() {
  let scrollTop = listContainer.elt.scrollTop;
  let index = Math.floor(scrollTop / itemHeight);
  index = constrain(index, 0, filteredArray.length - 1);
  selectedIndicator = filteredArray[index];

  let children = listContainer.elt.children;
  for (let i = 0; i < children.length; i++)
    children[i].classList.remove("selected-item");
  if (children[index]) children[index].classList.add("selected-item");

  if (selectedIndicator) showClosestIndicators(selectedIndicator);
}

// KOMMUNIKATION ZWISCHEN PAGES
function handleInput() {
  // Wendet Filter auf die Eingabe an (z. B. zur Anzeige oder Suche)
  applyFilters();

  // Versucht, eine Live-Anfrage über WebSocket an den „visual“-Raum zu senden
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
          // selectedIndicator: current,
        },
      });
    }
  } catch (e) {
    // Fehler werden ignoriert (z. B. wenn keine Verbindung besteht)
  }
}

function applyFilters() {
  let query = inputField.value().toLowerCase();

  filteredArray = dataArray.filter((item) => {
    let focus = (item["Focus Group"] || "").toLowerCase();
    let indicator = (item["Indicator English"] || "").toLowerCase();
    let matchesFocus = activeFocusGroups.has(focus);
    let matchesQuery = query.length < 3 || indicator.includes(query);
    return matchesFocus && matchesQuery;
  });

  renderList();
  listContainer.elt.scrollTop = 0;
}

// --- COSINE SIMILARITY ---
function cosineSim(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
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

// --- SHOW CLOSEST INDICATORS ---
function showClosestIndicators(currentItem) {
  const container = select("#contentContainer");
  container.html("");

  let currentEmbedding = currentItem.embedding;
  if (!currentEmbedding) return;

  let sims = dataArray.map((item) => ({
    item,
    sim: cosineSim(currentEmbedding, item.embedding || []),
  }));
  sims.sort((a, b) => b.sim - a.sim);
  let closest = sims.filter((s) => s.item !== currentItem).slice(0, 5);

  closest.forEach((s) => {
    let item = s.item;
    let newDiv = createDiv().parent(container);
    newDiv.class("item");

    let title = item["Indicator English"] || "No Title";
    let words = title
      .split(/\s+/)
      .map(
        (w) =>
          `<span class="clickable-word" data-word="${w}" data-id="${title}">${w}</span>`
      )
      .join(" ");

    newDiv.html(`
      <h3>${words}</h3>
      <p>Similarity: ${nf(s.sim, 1, 3)}</p>
      <p>Community: ${item["Community"] || "N/A"}</p>
      <p>Dimension: ${item["Dimension 1"] || "N/A"}</p>
    `);
  });

  document.querySelectorAll(".clickable-word").forEach((el) => {
    el.addEventListener("click", () => {
      let clickedWord = el.getAttribute("data-word");
      let indicatorTitle = el.getAttribute("data-id");

      inputField.value(clickedWord.toLowerCase());
      handleInput();

      let found = dataArray.find(
        (d) => d["Indicator English"] === indicatorTitle
      );
      if (found) {
        selectedIndicator = found;
        let index = filteredArray.indexOf(found);
        if (index !== -1) listContainer.elt.scrollTop = index * itemHeight;
      }
    });
  });
}

// --- UTILITY ---
function constrain(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
function windowResized() {
  listContainer.style("height", "600px");
}
