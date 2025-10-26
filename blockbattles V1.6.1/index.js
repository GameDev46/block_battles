const express = require("express");
const THREE = require("three");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

let playerPositionCache = [];
let playerLeftCache = [];

io.on("connection", (socket) => {
  console.log("New user");
  socket.join("lobby");

  socket.on("joined", () => {
    console.log("New player connected " + socket.id);
  });

  socket.on("position", (data) => {
    //io.to(room).emit("position", data, room, rotation);
    if (data.socketID == null) return;
    playerPositionCache.push(data);
  });

  socket.on("shootBall", (data) => {
    if (data.socketID == null) return;
    io.emit("shootBall", data);
  });

  socket.on("reloadingGun", (data) => {
    if (data.socketID == null) return;
    io.emit("reloadingGun", data);
  });

  socket.on("shotBullet", (data) => {
    if (data.socketID == null) return;
    io.emit("shotBullet", data);
  });

  socket.on("roomChange", (data) => {
    if (data.socketID == null) return;
    socket.join(data.room);
    io.emit("roomChange", data);
  });

  socket.on("hitPlayer", (data) => {
    if (data.socketID == null) return;
    io.emit("hitPlayer", data);
  });

  socket.on("killedPlayer", (data) => {
    if (data.socketID == null) return;
    io.emit("killedPlayer", data);
  });

  socket.on("disconnect", () => {
    //io.emit("leave", socket.id)
    playerLeftCache.push(socket.id);
    console.log("Player left: " + socket.id);
  });
});

app.use(express.static(path.join(__dirname, "/public")));

app.get("/", (req, res) => {
  fs.readFile("/public/index.html", "utf8", (err, data) => {
    if (err) throw err;

    res.write(data);
    return res.end();
  });
});

const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (let iface of Object.values(interfaces)) {
    for (let config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
};

server.listen(3000, '0.0.0.0', () => {
  const localIP = getLocalIPAddress();
  console.log(`Server is running on http://${localIP}:3000`);
});

function emitMessages() {
  // Update all players on server

  for (let i = 0; i < playerPositionCache.length; i++) {
    io.to(playerPositionCache[i].roomID).emit(
      "position",
      playerPositionCache[i],
    );
  }

  for (let i = 0; i < playerLeftCache.length; i++) {
    io.emit("leave", playerLeftCache[i]);
  }

  playerPositionCache = [];
  playerLeftCache = [];
}

const gameTickLoop = setInterval(emitMessages, 40);
