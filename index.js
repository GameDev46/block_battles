/*

 _____                         ______                 ___   ____ 
|  __ \                        |  _  \               /   | / ___|
| |  \/  __ _  _ __ ___    ___ | | | |  ___ __   __ / /| |/ /___ 
| | __  / _` || '_ ` _ \  / _ \| | | | / _ \\ \ / // /_| || ___ \
| |_\ \| (_| || | | | | ||  __/| |/ / |  __/ \ V / \___  || \_/ |
 \____/ \__,_||_| |_| |_| \___||___/   \___|  \_/      |_/\_____/


*/

/* 
	AUTHOR: GameDev46

	replit: https://replit.com/@GameDev46
	youtube: https://www.youtube.com/@gamedev46
	twitter: https://twitter.com/GameDev46
	github: https://github.com/GameDev46
*/

const express = require('express');
const THREE = require('three');
const fs = require("fs");
const path = require('path');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let playerPositionCache = []
let playerLeftCache = []

io.on('connection', (socket) => {
	console.log("New user")
	socket.join("qfhiehfiheahfijwdi9r3uru8u2uu2ue92eu9u");

	socket.on("joined", () => {
		console.log("New player connected " + socket.id)
	})

	socket.on("position", (data) => {
		//io.to(room).emit("position", data, room, rotation);
		playerPositionCache.push(data);
	})

	socket.on("roomChange", data => {
		socket.join(data.room);
		io.emit("roomChange", data);
	});

	socket.on("hitPlayer", data => {
		io.emit("hitPlayer", data);
	})

	socket.on("killedPlayer", data => {
		io.emit("killedPlayer", data);
	})

	socket.on("disconnect", () => {
		//io.emit("leave", socket.id)
		playerLeftCache.push(socket.id)
		console.log("Player left: " + socket.id)

	})
})

app.use(express.static(path.join(__dirname, '/public')));

app.get('/', (req, res) => {
	fs.readFile("/public/index.html", "utf8", (err, data) => {
		if (err) throw err;

		res.write(data)
		return res.end();
	})
});

server.listen(3000);
console.log("Server Listening")

function emitMessages() {
	// Update all players on server

	for (let i = 0; i < playerPositionCache.length; i++) {
		io.to(playerPositionCache[i].roomID).emit("position", playerPositionCache[i]);
	}

	for (let i = 0; i < playerLeftCache.length; i++) {
		io.emit("leave", playerLeftCache[i]);
	}

	playerPositionCache = [];
	playerLeftCache = [];
}

const gameTickLoop = setInterval(emitMessages, 40)
