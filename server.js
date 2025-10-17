const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// In Entwicklung: origin '*' OK. Produktion: setze CORS auf deine Render-Domain.
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "https://dataviz-quyb.onrender.com",
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, "public")));
// Serve Stefan assets (HTML is not served here; only static files for sketch usage)
app.use("/stefan", express.static(path.join(__dirname, "stefan")));

app.get("/", (req, res) => res.redirect("/index_petra"));
app.get("/index_petra", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index_petra.html"))
);
app.get("/monitor2", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "visual.html"))
);

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("join", (room) => {
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
  });

  socket.on("control", ({ targetRoom, payload }) => {
    io.to(targetRoom).emit("control", { from: socket.id, payload });
  });

  socket.on("disconnect", () => console.log("socket disconnected", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
