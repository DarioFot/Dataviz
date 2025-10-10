const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/monitor1", (r, s) =>
  s.sendFile(path.join(__dirname, "public/monitor1.html"))
);
app.get("/monitor2", (r, s) =>
  s.sendFile(path.join(__dirname, "public/monitor2.html"))
);

io.on("connection", (socket) => {
  console.log("verbunden:", socket.id);
  socket.on("control", (data) => {
    io.emit("update", data); // sendet an alle
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
