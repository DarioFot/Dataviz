// Lädt benötigte Module
const express = require("express"); // Express wird genutzt, um einen Webserver zu erstellen
const http = require("http"); // HTTP-Modul dient zum Erstellen des Servers
const path = require("path"); // Path hilft beim Umgang mit Dateipfaden
const { Server } = require("socket.io"); // Socket.IO ermöglicht Echtzeit-Kommunikation

// Erstellt eine neue Express-Anwendung
const app = express();

// Erstellt einen HTTP-Server basierend auf der Express-App
const server = http.createServer(app);

// Richtet einen Socket.IO-Server mit CORS-Einstellungen ein
const io = new Server(server, {
  cors: {
    // Erlaubt Verbindungen nur von einer bestimmten RL (z. B. von Rennder)
    origin: process.env.CORS_ORIGIN || "https://dataviz-quyb.onrender.com",
    methods: ["GET", "POST"], // Zulässige Methoden
  },
});

// Statische Dateien aus verschiedenen Ordnern werden bereitgestellt:

// Dateien aus dem "public"-Ordner werden öffentlich bereitgestellt (z. B. HTML-Dateien)
app.use(express.static(path.join(__dirname, "public")));

// Dateien aus dem "stefan"-Ordner sind unter "/stefan" erreichbar (nur Assets, kein HTML)
app.use("/stefan", express.static(path.join(__dirname, "stefan")));

// Dateien aus dem "Petra"-Ordner sind unter "/Petra" verfügbar
app.use("/Petra", express.static(path.join(__dirname, "Petra")));

// Gemeinsame Bibliotheken sind unter "/libraries" verfügbar
app.use("/libraries", express.static(path.join(__dirname, "libraries")));

// Dateien aus dem "fonts"-Ordner sind unter "/fonts" verfügbar
app.use("/fonts", express.static(path.join(__dirname, "fonts")));

// Weiterleitung von "/" zur Hauptanzeige "monitor1"
app.get("/", (req, res) => res.redirect("/monitor1"));

// Gibt die HTML-Datei für Monitor 1 zurück
app.get("/monitor1", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "monitor1.html"))
);

// Gibt die HTML-Datei für Monitor 2 zurück
app.get("/monitor2", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "visual.html"))
);

// Socket.IO-Verbindungen werden hier behandelt
io.on("connection", (socket) => {
  // Gibt aus, wenn ein neuer Client verbunden ist
  console.log("socket connected", socket.id);

  // Behandelt das Beitreten eines Clients zu einem bestimmten Raum
  socket.on("join", (room) => {
    socket.join(room); // Der Client tritt dem Raum bei
    console.log(`${socket.id} joined ${room}`); // Log-Ausgabe zur Kontrolle
  });

  // Behandelt "control"-Nachrichten von einem Client an einen bestimmten Raum
  socket.on("control", ({ targetRoom, payload }) => {
    // Sendet die Nachricht an alle Clients im Zielraum
    io.to(targetRoom).emit("control", { from: socket.id, payload });
  });

  // Gibt aus, wenn ein Client die Verbindung trennt
  socket.on("disconnect", () => console.log("socket disconnected", socket.id));
});

// Startet den Server auf dem angegebenen Port (Standard: 3000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
