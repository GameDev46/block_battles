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

	Youtube: https://www.youtube.com/@gamedev46
	Github: https://github.com/GameDev46
*/

// https://threejs.org/examples

//import {PointerLockControls} from 'https://threejs.org/examples/jsm/controls/PointerLockControls.js'
//import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';

import * as THREE from "./three/three.module.min.js";
import { PointerLockControls } from "./three/PointerLockControls.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { Sky } from "./three/sky.js";

import { vertexShader, fragmentShader } from "./shaders/grassShader.js";
import { worldData } from "./treeOffsets.js";

//import { GLTFLoader } from '/three/GLTFLoader.js';

let scene,
  camera,
  renderer,
  cube,
  clock,
  keyboard,
  controls,
  grassUniforms,
  grassInstances,
  grassMaterial,
  grassLODMap,
  cameraOffsetY,
  player,
  UIManager,
  mixer,
  playerAnimations,
  playerState,
  loadedActions,
  multiplayer,
  socket,
  panelOpen,
  fog;

grassUniforms;
grassInstances = [];
grassLODMap = [];
grassMaterial = 0;

cameraOffsetY = 0;

playerState = "static";
loadedActions = 0;

fog = {};

const WORLD_SIZE = 1600;

const speed = 10;
const sideSpeed = 8;

const runSpeedMultiplier = 2;

// 1 or larger
const density = 4;
const viewDistance = 12;

const chunkDimensions = 50;

const waterLevel = 1;
const maxGrassLevel = 12;

const treeSpread = 80;

playerAnimations = {};

player = {
  hasLoadedIn: false,
  lastChunk: 0,
  currentChunk: 0,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  staminaRegen: 20,
  staminaLoss: 20,
  kills: 0,
  name: "Player",
  velocity: {
    x: 0,
    y: 0,
    z: 0,
  },
  jumpVelocity: 25,
  grounded: true,
  gravity: 9.81 * 5,
  crouchHeight: 1,
  crouchSpeedMultiplier: 0.5,
  crouched: false,
  footstepAudio: new Audio("/player/sounds/grassFootsteps.wav"),
  waterFootstepAudio: new Audio("/player/sounds/waterFootsteps.wav"),
  gun: {
    selectedGun: 0,
    guns: [{
      name: "Pistol",
      ammo: 10,
      maxAmmo: 10,
      reloadCounter: 3,
      isReloading: false,
      reloadTime: 3,
      currentRecoil: 0,
      recoilSpeed: 5,
      recoil: 1.5,
      lastShootTime: 0,
      shootDelay: 0.2,
      damage: 20,
    }, {
      name: "Ball",
      ammo: 5,
      maxAmmo: 5,
      reloadCounter: 5,
      isReloading: false,
      reloadTime: 5,
      currentRecoil: 0,
      recoilSpeed: 5,
      recoil: 2,
      lastShootTime: 0,
      shootDelay: 0.5,
      damage: 40,
    }],
    shootAudio: new Audio("/player/sounds/pistolShoot.mp3"),
    reloadAudio: new Audio("/player/sounds/pistolReload.mp3"),
    hitAudio: new Audio("/player/sounds/impact.mp3"),
    damageAudio: new Audio("/player/sounds/playerDamaged.mp3"),
    hitTreeAudio: new Audio("/player/sounds/hitWood.wav"),
    collidableObjects: [],
    balls: [],
  },
};

player.footstepAudio.addEventListener(
  "ended",
  function () {
    this.currentTime = 0;
    this.play();
  },
  false,
);

player.footstepAudio.loop = true;

player.waterFootstepAudio.addEventListener(
  "ended",
  function () {
    this.currentTime = 0;
    this.play();
  },
  false,
);

player.waterFootstepAudio.loop = true;

multiplayer = {
  players: {},
  scores: {},
  balls: [],
  loadingPlayers: {},
  lastStates: {},
  playerAnimations: {},
  mixers: {},
  playerHitboxes: {},
  deathSound: new Audio("/player/sounds/playerDeath.mp3"),
};

UIManager = {
  ammo: document.getElementById("ammo"),
  maxAmmo: document.getElementById("maxAmmo"),
  reload: document.getElementById("reload"),
  health: document.getElementById("health"),
  stamina: document.getElementById("stamina"),
  FPS: document.getElementById("fps"),
  ping: document.getElementById("ping"),
  statsClass: document.querySelectorAll(".stats"),
  leaderboard: document.getElementById("leaderboard"),
  toggleGameUI: function (opacity) {
    for (let i = 0; i < UIManager.statsClass.length; i++) {
      this.statsClass[i].style.opacity = opacity;
    }

    this.leaderboard.style.opacity = opacity;
  },
};

UIManager.toggleGameUI(0);

keyboard = {};

let sceneLoader = new THREE.TextureLoader();

let textureLoader = {
  grass: sceneLoader.load("./textures/grass/grass2.png"),
  leaf: sceneLoader.load("./textures/leaves/desaturatedLeafTexture.png"),
  waterNormal: sceneLoader.load("./textures/waterNormal.png"),
};

function getGroundHeight(x, z) {
  //return 0;
  let largeDetails =
    Math.cos(x * 0.005) *
    Math.cos(z * 0.0025) *
    Math.sin(x * z * 0.15 * 0.0005) *
    20;
  largeDetails = clamp(largeDetails, -10, 10);

  // Small details don't work with the ground height - need to fix
  let smallDetails = Math.sin(x * 0.1) * Math.cos(z * 0.2) * 0.3;

  return largeDetails + smallDetails;
}

function clamp(num, low, up) {
  return Math.max(low, Math.min(num, up));
}

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  );

  clock = new THREE.Clock();

  fog.near = 100;
  fog.far = 1000;
  fog.colour = 0xddddff;

  scene.fog = new THREE.Fog(fog.colour, fog.near, fog.far);

  let shouldAntialias = localStorage.getItem("antialiasing") != "0";

  renderer = new THREE.WebGLRenderer({ antialias: shouldAntialias });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#87CEEB");

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.shadowMap.autoUpdate = false;

  renderer.outputEncoding = THREE.sRGBEncoding;

  // THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap, THREE.VSMShadowMap

  // Default pixel quality
  renderer.setPixelRatio(window.devicePixelRatio);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;

  document.body.appendChild(renderer.domElement);

  // Create floor

  player.gun.collidableObjects.push(
    createPlane({
      position: {
        x: 0,
        y: 2,
        z: 0,
      },
      scale: {
        x: WORLD_SIZE,
        y: WORLD_SIZE,
      },
      rotation: {
        x: Math.PI * -0.5,
        y: 0,
        z: 0,
      },
      segments: {
        x: Math.round(WORLD_SIZE / 8),
        y: Math.round(WORLD_SIZE / 8),
      },
      name: "ground",
      colour: 0x454545,
      doubleSided: false,
    }),
  );

  // Create Water

  createPlane({
    position: {
      x: 0,
      y: waterLevel,
      z: 0,
    },
    scale: {
      x: WORLD_SIZE,
      y: WORLD_SIZE,
    },
    rotation: {
      x: Math.PI * -0.5,
      y: 0,
      z: 0,
    },
    segments: {
      x: Math.round(WORLD_SIZE / 16),
      y: Math.round(WORLD_SIZE / 16),
    },
    name: "water",
    colour: 0xffffff,
    doubleSided: false,
  });

  camera.position.z = -100 * Math.sin(clock * 0.5);
  camera.position.y = 50;
  camera.position.x = 100 * Math.cos(clock * 0.5);

  camera.rotation.y = Math.PI / 1.5;
  camera.rotation.x = -Math.PI * 0.2;
  camera.rotation.z = 0;

  player.currentChunk = {
    x: Math.floor(camera.position.x / chunkDimensions),
    z: Math.floor(camera.position.z / chunkDimensions),
  };

  player.lastChunk = player.currentChunk;

  let sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  let sun = new THREE.Vector3();

  let uniforms = sky.material.uniforms;
  uniforms["turbidity"].value = 3;
  uniforms["rayleigh"].value = 1.4;
  uniforms["mieCoefficient"].value = 0.07;
  uniforms["mieDirectionalG"].value = 0.9999;

  sun.setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(-45),
    THREE.MathUtils.degToRad(120),
  );

  uniforms["sunPosition"].value.copy(sun);

  // add lights

  let light = new THREE.DirectionalLight(0xffefdd, 1.5);

  light.position.set(0, 50, 0);
  light.castShadow = true;

  light.shadow.camera.near = 1;
  light.shadow.camera.far = 500;

  light.shadow.bias = -0.001;

  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;

  light.shadow.camera.left = 400;
  light.shadow.camera.right = -400;
  light.shadow.camera.top = -10;
  light.shadow.camera.bottom = -80;

  scene.add(light);

  light.target.position.set(10, 40, 10);

  scene.add(light.target);

  light = new THREE.AmbientLight(0xffeeaa, 1);
  light.position.set(0, 0, 0);
  scene.add(light);

  // Setup socket

  socket = io();
  player.room = "lobby";

  socket.emit("joined");

  panelOpen = "";

  // Control the main menu panels

  document.getElementById("credits").addEventListener("click", (e) => {
    openPanel("credits", document.getElementById("creditsPanel"));
  });

  document.getElementById("openRoomOptions").addEventListener("click", (e) => {
    openPanel("openRoomOptions", document.getElementById("joinRoom"));
  });

  document.getElementById("settings").addEventListener("click", (e) => {
    openPanel("settings", document.getElementById("settingsPanel"));
  });

  // Update both name inputs when one is changed

  document.getElementById("lobbyNameInput").addEventListener("change", (e) => {
    document.getElementById("nameInput").value =
      document.getElementById("lobbyNameInput").value;
  });

  document.getElementById("nameInput").addEventListener("change", (e) => {
    document.getElementById("lobbyNameInput").value =
      document.getElementById("nameInput").value;
  });

  // Load saved name

  document.getElementById("lobbyNameInput").value =
    localStorage.getItem("username") || "";
  document.getElementById("nameInput").value =
    localStorage.getItem("username") || "";

  // Join game when a button is clicked

  document.getElementById("joinLobby").addEventListener("click", (e) => {
    camera.position.z = 0;
    camera.position.y = 10;
    camera.position.x = 0;

    camera.rotation.y = Math.PI / 1.5;
    camera.rotation.x = 0;
    camera.rotation.z = 0;

    loadPlayer();
    loadWeapon();
    player.hasLoadedIn = true;

    socket.emit("roomChange", {
      room: "lobby",
      lastRoom: player.room,
      socketID: socket.id,
    });

    // Clear all player models

    for (let key in multiplayer.players) {
      if (multiplayer.players[key]) {
        scene.remove(multiplayer.players[key]);
        scene.remove(multiplayer.playerHitboxes[key]);

        multiplayer.scores[key] = null;
        multiplayer.players[key] = null;
        multiplayer.loadingPlayers[key] = null;
        multiplayer.playerHitboxes[key] = null;
      }
    }

    player.room = "lobby";
    player.name = document.getElementById("lobbyNameInput").value || "Guest";

    localStorage.setItem("username", player.name);

    UIManager.toggleGameUI(1);
    document.getElementById("roomName").innerText = "Room: " + player.room;
    document.getElementById("mainMenu").style.display = "none";
  });

  document.getElementById("joinButton").addEventListener("click", (e) => {
    camera.position.z = 0;
    camera.position.y = 10;
    camera.position.x = 0;

    camera.rotation.y = Math.PI / 1.5;
    camera.rotation.x = 0;
    camera.rotation.z = 0;

    // Hide panel
    openPanel("openRoomOptions", document.getElementById("joinRoom"));

    loadPlayer();
    loadWeapon();
    player.hasLoadedIn = true;

    let newRoom = document.getElementById("roomInput").value;

    socket.emit("roomChange", {
      room: newRoom,
      lastRoom: player.room,
      socketID: socket.id,
    });

    // Clear all player models

    for (let key in multiplayer.players) {
      if (multiplayer.players[key]) {
        scene.remove(multiplayer.players[key]);
        scene.remove(multiplayer.playerHitboxes[key]);

        multiplayer.scores[key] = null;
        multiplayer.players[key] = null;
        multiplayer.loadingPlayers[key] = null;
        multiplayer.playerHitboxes[key] = null;
      }
    }

    player.room = newRoom;
    player.name = document.getElementById("nameInput").value;

    localStorage.setItem("username", player.name);

    UIManager.toggleGameUI(1);
    document.getElementById("roomName").innerText = "Room: " + player.room;
    document.getElementById("mainMenu").style.display = "none";
  });

  socket.on("roomChange", (data) => {
    if (data.lastRoom == player.room) {
      if (multiplayer.players[data.socketID]) {
        scene.remove(multiplayer.players[data.socketID]);
        scene.remove(multiplayer.playerHitboxes[data.socketID]);

        multiplayer.scores[data.socketID] = null;
        multiplayer.players[data.socketID] = null;
        multiplayer.loadingPlayers[data.socketID] = null;
        multiplayer.playerHitboxes[data.socketID] = null;
      }
    }
  });

  /* data for position: {
			position: {
				x: camera.position.x,
				y: camera.position.y,
				z: camera.position.z
			},
			socketID: socket.id,
			kills: player.kills,
			name: player.name,
			health: player.health,
			rotation: camera.rotation.y,
			roomID: player.room,
				state: playerState
		} */

  socket.on("position", (data) => {
    if (data.roomID == player.room && data.socketID != undefined) {
      if (data.socketID != socket.id) {
        // Create or position player
        if (multiplayer.loadingPlayers[data.socketID] != true) {
          multiplayer.loadingPlayers[data.socketID] = true;
          createOnlinePlayer(data.socketID);
        }

        if (multiplayer.players[data.socketID] != null) {
          /*multiplayer.players[data.socketID].position.set(
            data.position.x,
            getGroundHeight(data.position.x, data.position.z) + 3,
            data.position.z,
          );*/

          multiplayer.players[data.socketID].position.set(
            data.position.x,
            data.position.y - 7.5,
            data.position.z,
          );

          multiplayer.playerHitboxes[data.socketID].position.set(
            multiplayer.players[data.socketID].position.x,
            multiplayer.players[data.socketID].position.y + 4,
            multiplayer.players[data.socketID].position.z,
          );

          multiplayer.players[data.socketID].rotation.order = "ZYX";
          multiplayer.players[data.socketID].rotation.y =
            data.rotation + 3.1415;

          // Update animations

          let multiplayerLastState =
            multiplayer.lastStates[data.socketID] || "walk";

          if (multiplayerLastState != data.state) {
            if (
              multiplayerLastState != "" &&
              multiplayer.playerAnimations[data.socketID][
                multiplayerLastState
              ] != null
            ) {
              fadeToAction(
                multiplayer.playerAnimations[data.socketID][
                  multiplayerLastState
                ],
                multiplayer.playerAnimations[data.socketID][data.state],
                0.2,
              );
            }

            //playerAnimations[lastState].stop();
            //playerAnimations[state].play();

            multiplayer.lastStates[data.socketID] = data.state;
          }
        }

        // Update scores

        multiplayer.scores[data.socketID] = {
          name: data.name,
          kills: data.kills,
        };
      } else {
        UIManager.ping.innerText = "Ping: " + (Date.now() - data.time) + "ms";
      }
    }
  });

  socket.on("shootBall", (data) => {
    if (data.roomID == player.room && data.socketID != socket.id) {
      let gunPos = new THREE.Vector3();
      gunPos.x = data.position.x;
      gunPos.y = data.position.y;
      gunPos.z = data.position.z;

      let velocity = new THREE.Vector3();
      velocity.x = data.velocity.x;
      velocity.y = data.velocity.y;
      velocity.z = data.velocity.z;

      createProjectile(gunPos, velocity, data.socketID);
    }
  });

  socket.on("hitPlayer", (data) => {
    if (data.roomID == player.room) {
      if (data.hitPlayer == socket.id) {
        // Deduct health
        player.health -= data.damage;

        // Play player damaged sound

        player.gun.damageAudio.currentTime = 0;
        player.gun.damageAudio.play();

        if (player.health <= 0) {
          socket.emit("killedPlayer", {
            roomID: player.room,
            hitPlayer: socket.id,
            socketID: data.socketID,
            distance: data.distance,
          });

          player.health = 100;

          camera.position.set(0, 0, 0);

          // Play player death sound

          multiplayer.deathSound.currentTime = 0;
          multiplayer.deathSound.play();
        }
      }
    }
  });

  socket.on("killedPlayer", (data) => {
    if (data.roomID == player.room) {
      if (data.socketID == socket.id) {
        // Killed player
        player.kills += 1;

        // Play death sound

        //multiplayer.deathSound.volume = Math.max(0, (1 - (data.distance / 70)))
        multiplayer.deathSound.play();
      }
    }
  });

  socket.on("leave", (data) => {
    if (multiplayer.players[data]) {
      scene.remove(multiplayer.players[data]);
      scene.remove(multiplayer.playerHitboxes[data]);

      multiplayer.scores[data] = null;
      multiplayer.players[data] = null;
      multiplayer.loadingPlayers[data] = null;
      multiplayer.playerHitboxes[data] = null;
    }
  });

  // Setup listeners

  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button == 0) {
      // Shoot on left click

      if (player.gun.guns[player.gun.selectedGun].ammo > 0 && !player.gun.guns[player.gun.selectedGun].isReloading) {
        player.gun.guns[player.gun.selectedGun].ammo -= 1;

        // Recoil

        player.gun.guns[player.gun.selectedGun].currentRecoil = player.gun.guns[player.gun.selectedGun].recoil;

        player.gun.shootAudio.volume = 0.5;
        player.gun.shootAudio.playbackRate = 1.5;

        player.gun.shootAudio.currentTime = 0;
        player.gun.shootAudio.play();

        if (player.gun.selectedGun == 1) {
          // Shoot ball
          let gunPos = new THREE.Vector3();
          player.gun.guns[player.gun.selectedGun].mesh.getWorldPosition(gunPos);

          let velocity = new THREE.Vector3();
          camera.getWorldDirection(velocity);
          velocity.x *= 100;
          velocity.y *= 100;
          velocity.z *= 100;

          createProjectile(gunPos, velocity, socket.id);

          socket.emit("shootBall", {
            roomID: player.room,
            position: {
              x: gunPos.x,
              y: gunPos.y,
              z: gunPos.z,
            },
            velocity: {
              x: velocity.x,
              y: velocity.y,
              z: velocity.z,
            },
            socketID: socket.id,
          });

        } else {

          // Fire gun via raycast

          let distanceToRaycast = 800;

          let cameraLookVector = new THREE.Vector3();
          camera.getWorldDirection(cameraLookVector);

          let positionVector = new THREE.Vector3();
          player.gun.guns[player.gun.selectedGun].mesh.getWorldPosition(positionVector);

          let raycastStartPos = positionVector;

          let raycaster = new THREE.Raycaster(
            raycastStartPos,
            cameraLookVector,
            0,
            distanceToRaycast,
          );

          // Setup collidable objects array

          let sceneModels = player.gun.collidableObjects;

          for (let playerID in multiplayer.players) {
            if (multiplayer.playerHitboxes[playerID] != null) {
              sceneModels.push(multiplayer.playerHitboxes[playerID]);
            }
          }

          let intersects = raycaster.intersectObjects(sceneModels);

          // Check for players

          let hitInfo = {
            distance: distanceToRaycast + 100,
            humanoid: null,
          };

          for (let i = 0; i < intersects.length; i++) {
            if (intersects[i].object.isMultiplayerHumanoid == true) {
              let humanoidDistance = intersects[i].distance;

              if (hitInfo.distance > humanoidDistance) {
                hitInfo.distance = humanoidDistance;
                hitInfo.humanoid = intersects[i].object;
              }
            } else {
              let hitDistance = intersects[i].distance;

              if (hitInfo.distance > hitDistance) {
                // Remove hit player as they are behind an obstacle

                hitInfo.distance = hitDistance;
                hitInfo.humanoid = null;

                // Play hit sound
                player.gun.hitTreeAudio.currentTime = 0;
                player.gun.hitTreeAudio.volume = Math.min(2, 10 / hitDistance);
                player.gun.hitTreeAudio.play();
              }
            }
          }

          // Send data to server

          if (hitInfo.humanoid != null) {
            let hitSocketId = hitInfo.humanoid.ownerSocket;

            if (hitSocketId != null) {
              // Play hit audio

              player.gun.hitAudio.currentTime = 0;
              player.gun.hitAudio.play();

              socket.emit("hitPlayer", {
                roomID: player.room,
                hitPlayer: hitSocketId,
                socketID: socket.id,
                distance: hitInfo.distance,
                damage: player.gun.guns[player.gun.selectedGun].damage,
              });
            }
          }

        }

        player.gun.guns[player.gun.selectedGun].reloadCounter =
          (player.gun.guns[player.gun.selectedGun].ammo / player.gun.guns[player.gun.selectedGun].maxAmmo) * player.gun.guns[player.gun.selectedGun].reloadTime;

        if (player.gun.guns[player.gun.selectedGun].ammo <= 0) {
          player.gun.guns[player.gun.selectedGun].reloadCounter = 0;
          player.gun.guns[player.gun.selectedGun].isReloading = true;

          player.gun.reloadAudio.currentTime = 0;
          player.gun.reloadAudio.play();
        }
      }
    }

    if (e.button == 2) {
      // Zoom in on right click
      keyboard["rightClick"] = true;
    }
  });

  renderer.domElement.addEventListener("mouseup", (e) => {
    if (e.button == 2) {
      // Zoom out on right click
      keyboard["rightClick"] = false;
    }
  });
}

function openPanel(panelName, panelElement) {
  if (panelOpen != panelName && panelOpen != "") return;

  if (panelElement.style.display == "flex") {
    panelElement.style.display = "none";

    document.getElementById("joinLobby").style.opacity = 1;
    document.getElementById("lobbyNameInput").style.opacity = 1;

    panelOpen = "";
  } else {
    panelElement.style.display = "flex";

    document.getElementById("joinLobby").style.opacity = 0;
    document.getElementById("lobbyNameInput").style.opacity = 0;

    panelOpen = panelName;
  }
}

function getDistance(v1, v2) {
  let dx = v1.x - v2.x;
  let dy = v1.y - v2.y;
  let dz = v1.z - v2.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function zoomInFunction(zoomAmount, speed) {
  const fov = getFov();
  camera.fov = clickZoom(fov, "zoomIn", zoomAmount, speed);
  camera.updateProjectionMatrix();
}

function zoomOutFunction(zoomAmount, speed) {
  const fov = getFov();
  camera.fov = clickZoom(fov, "zoomOut", zoomAmount, speed);
  camera.updateProjectionMatrix();
}

function clickZoom(value, zoomType, zoomAmount, speed) {
  if (value >= zoomAmount && zoomType === "zoomIn") {
    return value - speed;
  } else if (value <= 75 && zoomType === "zoomOut") {
    return value + speed;
  } else {
    return value;
  }
}

function getFov() {
  return Math.floor(
    (2 *
      Math.atan(camera.getFilmHeight() / 2 / camera.getFocalLength()) *
      180) /
      Math.PI,
  );
}

function createOnlinePlayer(multiplayerID) {
  // Model + animations from mixamo - https://www.mixamo.com/

  let loader = new GLTFLoader();

  loader.load("/player/mixamoCharacter.glb", function (gltf) {
    gltf.scene.traverse(function (child) {
      child.castShadow = true;
      child.frustumCulled = false;
    });

    let mesh = gltf.scene.children[0];

    mesh.position.set(0, 0, 0);
    mesh.scale.setScalar(0.045);

    multiplayer.mixers[multiplayerID] = new THREE.AnimationMixer(mesh);

    multiplayer.playerAnimations[multiplayerID] = {};

    loader.load("/player/animations/backwardAnim.glb", function (anim) {
      multiplayer.playerAnimations[multiplayerID].backward = multiplayer.mixers[
        multiplayerID
      ].clipAction(anim.animations[6]);
    });

    loader.load("/player/animations/runAnim.glb", function (anim) {
      multiplayer.playerAnimations[multiplayerID].run = multiplayer.mixers[
        multiplayerID
      ].clipAction(anim.animations[6]);
    });

    loader.load("/player/animations/staticAnim.glb", function (anim) {
      multiplayer.playerAnimations[multiplayerID].static = multiplayer.mixers[
        multiplayerID
      ].clipAction(anim.animations[6]);
    });

    loader.load("/player/animations/strafeAnim.glb", function (anim) {
      multiplayer.playerAnimations[multiplayerID].strafe = multiplayer.mixers[
        multiplayerID
      ].clipAction(anim.animations[6]);
    });

    loader.load("/player/animations/walkAnim.glb", function (anim) {
      multiplayer.playerAnimations[multiplayerID].walk = multiplayer.mixers[
        multiplayerID
      ].clipAction(anim.animations[6]);
    });

    scene.add(mesh);

    multiplayer.players[multiplayerID] = mesh;

    // Create the players hitbox

    const cubeGeometry = new THREE.BoxGeometry(3, 9, 3);
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

    cube.position.x = mesh.position.x;
    cube.position.y = mesh.position.y + 4;
    cube.position.z = mesh.position.z;

    cube.rotation.x = 0;
    cube.rotation.y = 0;
    cube.rotation.z = 0;

    cube.receiveShadow = false;
    cube.castShadow = false;

    cube.visible = false;

    cube.isMultiplayerHumanoid = true;
    cube.ownerSocket = multiplayerID;

    scene.add(cube);

    multiplayer.playerHitboxes[multiplayerID] = cube;
  });
}

function createProjectile(position, velocity, ownerID) {
  let randomBallColours = [
    0xff2222,
    0x22ff22,
    0x2222ff,
    0xffff22,
    0xff22ff,
    0x22ffff,
    0xff00ff,
    0x00ffff,
    0xffff00,
  ];

  let randomBallColour = randomBallColours[Math.floor(Math.random() * randomBallColours.length)];
  
  let ballGeometry = new THREE.SphereGeometry(0.25, 12, 12);
  let ballMaterial = new THREE.MeshPhongMaterial({
    color: randomBallColour,
    specular: 0xefefef,
    shininess: 100
  });

  let ball = new THREE.Mesh(ballGeometry, ballMaterial);

  ball.position.set(position.x, position.y, position.z);
  scene.add(ball);

  ball.castShadow = true;
  ball.receiveShadow = true;
  ball.isBall = true;
  ball.ownerSocket = ownerID;

  ball.velocity = new THREE.Vector3();
  ball.velocity.x = velocity.x;
  ball.velocity.y = velocity.y;
  ball.velocity.z = velocity.z;

  multiplayer.balls.push(ball);
  return ball;
}

function loadTrees() {

  let loader = new GLTFLoader();

  loader.load("/treeModel/willowTree.glb", function (gltf) {
    gltf.scene.traverse(function (child) {
      child.castShadow = true;

      if (child.isMesh) {
        child.material.metalness = 0;
        child.material.depthWrite = true;
      }
    });

    let mesh = gltf.scene;

    /*let treeOffsets = [];

		for (let x = 0; x < WORLD_SIZE; x += ((Math.random() + 1) * treeSpread)) {

			for (let z = 0; z < WORLD_SIZE; z += ((Math.random() + 1) * treeSpread)) {

				//let randX = (Math.random() - 0.5) * 800;
				//let randZ = (Math.random() - 0.5) * 800;

				let randX = x - (WORLD_SIZE / 2);
				let randZ = z - (WORLD_SIZE / 2);

				randX += (Math.random() - 0.5) * treeSpread * 0.5;
				randZ += (Math.random() - 0.5) * treeSpread * 0.5;

				let groundHeight = getGroundHeight(randX, randZ);

				if (groundHeight > waterLevel) {

					treeOffsets.push({ x: randX, z: randZ });

				}

			}

		}

		console.log(treeOffsets);*/

    for (let i = 0; i < worldData.treeOffsets.length; i++) {
      let randX = worldData.treeOffsets[i].x;
      let randZ = worldData.treeOffsets[i].z;

      let groundHeight = getGroundHeight(randX, randZ);

      if (groundHeight > waterLevel) {
        let currentMesh = mesh.clone();

        let randRotation = (i % 10) * 3.1415 * 0.1;

        scene.add(currentMesh);
        currentMesh.position.set(randX, groundHeight + 0.5, randZ);
        currentMesh.scale.set(5, 5, 5);
        currentMesh.rotateY(randRotation);

        // Create the trees' hitboxes

        const cubeGeometry = new THREE.BoxGeometry(
          6,
          30,
          6,
        );
        
        const cubeMaterial = new THREE.MeshLambertMaterial({
          color: 0xffffff,
        });

        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        cube.position.x = currentMesh.position.x;
        cube.position.y = currentMesh.position.y + 15;
        cube.position.z = currentMesh.position.z;

        cube.rotation.x = 0;
        cube.rotation.y = 0;
        cube.rotation.z = 0;

        cube.receiveShadow = false;
        cube.castShadow = false;

        cube.visible = false;

        scene.add(cube);

        player.gun.collidableObjects.push(cube);
      }
    }
  });

  renderer.shadowMap.needsUpdate = true;
}

function loadBushes() {
  // "A round bundle of straw in the field" (https://skfb.ly/6szwE) by 3dhdscan is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

  let loader = new GLTFLoader();

  loader.load("/haybale/scene.gltf", function (gltf) {
    gltf.scene.traverse(function (child) {
      child.castShadow = true;
    });

    let mesh = gltf.scene.children[0];

    /*let bushOffsets = [];

    for (let x = 0; x < WORLD_SIZE; x += (Math.random() + 1) * treeSpread * 2) {
      for (
        let z = 0;
        z < WORLD_SIZE;
        z += (Math.random() + 1) * treeSpread * 2
      ) {
        //let randX = (Math.random() - 0.5) * 800;
        //let randZ = (Math.random() - 0.5) * 800;

        let randX = x - WORLD_SIZE / 2;
        let randZ = z - WORLD_SIZE / 2;

        randX += (Math.random() - 0.5) * treeSpread * 0.5;
        randZ += (Math.random() - 0.5) * treeSpread * 0.5;

        let groundHeight = getGroundHeight(randX, randZ);

        if (groundHeight > waterLevel) {
          bushOffsets.push({ x: randX, z: randZ });
        }
      }
    }

    console.log(bushOffsets);*/

    for (let i = 0; i < worldData.bushOffsets.length; i++) {
      let randX = worldData.bushOffsets[i].x;
      let randZ = worldData.bushOffsets[i].z;

      let groundHeight = getGroundHeight(randX, randZ);

      if (groundHeight > waterLevel) {
        let currentMesh = mesh.clone();

        let randRotation = (i % 10) * 3.1415 * 0.5;

        scene.add(currentMesh);
        currentMesh.position.set(randX, groundHeight + 2, randZ);
        currentMesh.scale.set(0.6, 0.6, 0.6);
        //currentMesh.rotateY(randRotation);

        // Create haybale hitbox

        const cubeGeometry = new THREE.BoxGeometry(13, 15, 10);
        const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        cube.position.x = currentMesh.position.x;
        cube.position.y = currentMesh.position.y + 4;
        cube.position.z = currentMesh.position.z;

        cube.rotation.x = 0;
        cube.rotation.y = 0;
        cube.rotation.z = 0;

        cube.receiveShadow = false;
        cube.castShadow = false;

        cube.visible = false;

        scene.add(cube);

        player.gun.collidableObjects.push(cube);
      }
    }
  });

  renderer.shadowMap.needsUpdate = true;
}

function loadPlayer() {
  // Model + animations from mixamo - https://www.mixamo.com/

  let loader = new GLTFLoader();

  loader.load("/player/headlessMixamoCharacter.glb", function (gltf) {
    gltf.scene.traverse(function (child) {
      child.castShadow = true;
      child.frustumCulled = false;
    });

    let mesh = gltf.scene.children[0];

    let pivot = new THREE.Group();
    pivot.position.set(camera.position.x, camera.position.y, camera.position.z);
    pivot.add(mesh);

    mesh.position.set(0, 0, 0);
    mesh.scale.setScalar(0.045);

    playerAnimations = {
      static: "",
      backward: "",
      run: "",
      strafe: "",
      walk: "",
    };

    mixer = new THREE.AnimationMixer(pivot);
    //playerAnimations = mixer.clipAction(gltf.animations[6]);

    loader.load("/player/animations/backwardAnim.glb", function (anim) {
      playerAnimations.backward = mixer.clipAction(anim.animations[6]);

      loadedActions++;
    });

    loader.load("/player/animations/runAnim.glb", function (anim) {
      playerAnimations.run = mixer.clipAction(anim.animations[6]);

      loadedActions++;
    });

    loader.load("/player/animations/staticAnim.glb", function (anim) {
      playerAnimations.static = mixer.clipAction(anim.animations[6]);

      loadedActions++;
    });

    loader.load("/player/animations/strafeAnim.glb", function (anim) {
      playerAnimations.strafe = mixer.clipAction(anim.animations[6]);

      loadedActions++;
    });

    loader.load("/player/animations/walkAnim.glb", function (anim) {
      playerAnimations.walk = mixer.clipAction(anim.animations[6]);

      loadedActions++;
    });

    let rightShoulder = mesh.children[0].children[0].children[0].children[0].children[2];
    player.rightHand = rightShoulder.children[0].children[0].children[0];

    player.spine = mesh.children[0].children[0].children[0].children[0];

    player.mesh = mesh;
    player.pivot = pivot;

    scene.add(gltf.scene);
    scene.add(pivot);
  });

  //renderer.shadowMap.needsUpdate = true;
}

function loadWeapon() {
  // "Pistol" (https://skfb.ly/6REZM) by DJMaesen is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/)

  let loader = new GLTFLoader();

  loader.load("/pistol/scene.gltf", function (gltf) {
    gltf.scene.traverse(function (child) {
      child.castShadow = true;
    });

    let mesh = gltf.scene.children[0];

    mesh.position.set(0, 0, 0);
    mesh.scale.setScalar(0.75);

    let secondaryMesh = mesh.clone();

    scene.add(mesh);
    scene.add(secondaryMesh);

    player.gun.guns[0].mesh = mesh;
    player.gun.guns[1].mesh = secondaryMesh;

    player.rightHand.add(mesh);
    player.rightHand.add(secondaryMesh);
  });
}

function createCube(objectInfo) {
  const geometry = new THREE.BoxGeometry(
    objectInfo.scale.x,
    objectInfo.scale.y,
    objectInfo.scale.z,
  );

  const material = new THREE.MeshLambertMaterial({
    color: objectInfo.colour || 0x61991c,
  });

  cube = new THREE.Mesh(geometry, material);

  cube.position.x = objectInfo.position.x;
  cube.position.y = objectInfo.position.y;
  cube.position.z = objectInfo.position.z;

  cube.rotation.x = objectInfo.rotation.x;
  cube.rotation.y = objectInfo.rotation.y;
  cube.rotation.z = objectInfo.rotation.z;

  cube.receiveShadow = true;
  cube.castShadow = true;

  scene.add(cube);

  return cube;
}

// Create a plane

function createPlane(objectInfo) {
  const geometry = new THREE.PlaneGeometry(
    objectInfo.scale.x,
    objectInfo.scale.y,
    objectInfo.segments.x,
    objectInfo.segments.y,
  );

  let material = new THREE.MeshLambertMaterial({
    color: objectInfo.colour || 0x61991c,
  });

  if (objectInfo.doubleSided) {
    material = new THREE.MeshLambertMaterial({
      color: objectInfo.colour || 0x61991c,
      side: THREE.DoubleSide,
    });
  }

  if (objectInfo.name == "ground") {
    let texture = textureLoader.grass;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(0, 0);
    texture.repeat.set(13, 13);

    material = new THREE.MeshPhongMaterial({
      map: texture,
      specular: 0x1f1f1f,
      shininess: 1,
      color: objectInfo.colour || 0xffffff,
    });

    const positionAttribute = geometry.getAttribute("position");

    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i); // read vertex

      // do something with vertex

      positionAttribute.setXYZ(
        i,
        vertex.x,
        vertex.y,
        vertex.z - getGroundHeight(vertex.x, vertex.y),
      ); // write coordinates back
    }
  }

  if (objectInfo.name == "water") {
    let texture = textureLoader.waterNormal;
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.offset.set(0, 0);
    texture.repeat.set(100, 100);

    material = new THREE.MeshPhongMaterial({
      color: 0x5365b5,
      opacity: 0.5,
      normalMap: texture,
      normalScale: new THREE.Vector2(0.05, 0.05),
      side: THREE.DoubleSide,
      transparent: true,
      specular: 0xefefef,
      shininess: 50,
      reflectivity: 1,
    });

    material.depthWrite = false;
  }

  let plane = new THREE.Mesh(geometry, material);

  plane.receiveShadow = true;
  plane.castShadow = true;

  if (objectInfo.name == "water") {
    plane.receiveShadow = false;
    plane.castShadow = false;
  }

  plane.position.x = objectInfo.position.x;
  plane.position.y = objectInfo.position.y;
  plane.position.z = objectInfo.position.z;

  plane.rotation.x = objectInfo.rotation.x;
  plane.rotation.y = objectInfo.rotation.y;
  plane.rotation.z = objectInfo.rotation.z;

  scene.add(plane);

  return plane;
}

// Create a blade of grass

function createGrass(objectInfo) {
  // Setup instancing

  //const grassGeometry = new THREE.PlaneGeometry(objectInfo.scale.x, objectInfo.scale.y, objectInfo.segments.x, objectInfo.segments.y);

  let grassGeometry = new THREE.BufferGeometry();

  // create a simple square shape. We duplicate the top left and bottom right
  // vertices because each vertex needs to appear once per triangle.
  let vertices = new Float32Array([
    0.15,
    -2.0,
    1.0, // v1
    -0.15,
    -2.0,
    1.0, // v2
    0.0,
    3.0,
    1.0, // v3
  ]);

  // Create your UVs array - two per vertex - based on your geometry
  // These example UV coordinates describe a right-angled triangle
  let uvs = [0, 0, 1, 0, 1, 1];

  if (objectInfo.LOD == 0) {
    // More vertices

    vertices = new Float32Array([
      -0.15,
      -2.0,
      1.0, // v0
      0.15,
      -2.0,
      1.0, // v1
      0.15,
      -0.2,
      1.0, // v2

      0.15,
      -0.2,
      1.0, // v3
      -0.15,
      -0.2,
      1.0, // v4
      -0.15,
      -2.0,
      1.0, // v5

      0.15,
      -0.2,
      1.0, // v1
      -0.15,
      -0.2,
      1.0, // v2
      -0.1,
      0.5,
      1.0, // v3

      0.15,
      -0.2,
      1.0, // v4
      0.1,
      0.5,
      1.0, // v5
      -0.1,
      0.5,
      1.0, // v6

      0.05,
      2.0,
      1.0, // v1
      0.1,
      0.5,
      1.0, // v2
      -0.1,
      0.5,
      1.0, // v3

      0.05,
      2.0,
      1.0, // v4
      -0.05,
      2.0,
      1.0, // v5
      -0.1,
      0.5,
      1.0, // v6

      0.05,
      2.0,
      1.0, // v1
      -0.05,
      2.0,
      1.0, // v2
      0.0,
      3.0,
      1.0, // v3
    ]);

    uvs = [
      0, 0, 1, 0, 1, 0.25,

      1, 0.25, 0, 0.25, 0, 0,

      1, 0.25, 0, 0.25, 0, 0.5,

      1, 0.25, 1, 0.5, 0, 0.5,

      1, 0.75, 1, 0.5, 0, 0.5,

      1, 0.75, 0, 0.75, 0, 0.5,

      1, 0.75, 0, 0.75, 1, 1,
    ];
  } else if (objectInfo.LOD == 1) {
    vertices = new Float32Array([
      -0.15,
      -2.0,
      1.0, // v0
      0.15,
      -2.0,
      1.0, // v1
      0.15,
      -0.2,
      1.0, // v2

      0.15,
      -0.2,
      1.0, // v3
      -0.15,
      -0.2,
      1.0, // v4
      -0.15,
      -2.0,
      1.0, // v5

      0.15,
      -0.2,
      1.0, // v1
      -0.15,
      -0.2,
      1.0, // v2
      0.0,
      3.0,
      1.0, // v3
    ]);

    // Create your UVs array - two per vertex - based on your geometry
    // These example UV coordinates describe a right-angled triangle
    uvs = [
      0, 0, 1, 0, 1, 0.25,

      1, 0.25, 0, 0.25, 0, 0,

      1, 0.25, 0, 0.25, 1, 1,
    ];
  }

  // Set the attribute on your  geometry
  grassGeometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(uvs), 2),
  );

  // itemSize = 3 because there are 3 values (components) per vertex
  grassGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(vertices, 3),
  );

  if (grassMaterial == 0) {
    let texture = textureLoader.leaf;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(0, 0);
    texture.repeat.set(1, 1);

    grassUniforms = {
      time: {
        value: 0,
      },
      lightIntensity: {
        value: 0.6,
      },
      sunColour: {
        value: new THREE.Vector3(1, 0.9, 0.7),
      },
      LOD: {
        value: 0,
      },
      fogColour: {
        value: new THREE.Vector3(0.85, 0.85, 1.0),
      },
      fogNear: {
        value: fog.near,
      },
      fogFar: {
        value: fog.far,
      },
    };

    grassMaterial = new THREE.ShaderMaterial({
      uniforms: grassUniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide,
    });

    grassMaterial.transparent = false;
    //grassMaterial.depthWrite = true;

    /*plane = new THREE.Mesh(geometry, grassMaterial);

		plane.receiveShadow = true;
		plane.castShadow = true;

		plane.position.x = objectInfo.position.x;
		plane.position.y = objectInfo.position.y;
		plane.position.z = objectInfo.position.z;

		plane.rotation.x = objectInfo.rotation.x;
		plane.rotation.y = objectInfo.rotation.y;
		plane.rotation.z = objectInfo.rotation.z;*/
  }

  /*let material = new THREE.MeshPhongMaterial({
		 map: texture,
		 side: THREE.DoubleSide,
		 alphaMap: textureLoader.glassAlpha,
		 transparent: true,
		 specular: 0x575757,
		 shininess: 50
	 });*/

  const localDensity = Math.max(1, Math.round(density - objectInfo.LOD));

  let plane = new THREE.InstancedMesh(
    grassGeometry,
    grassMaterial,
    chunkDimensions * chunkDimensions * localDensity,
  );

  const mock = new THREE.Object3D();

  let row = -1;
  let column = 0;

  for (let i = 0; i < chunkDimensions * chunkDimensions; i++) {
    if (i % chunkDimensions == 0) {
      row += 1;
      column = 0;
    }

    for (let d = 0; d < localDensity; d++) {
      let offsetX = (Math.random() - 0.5) / localDensity;
      let offsetZ = (Math.random() - 0.5) / localDensity;

      let xPos = objectInfo.position.x + column + offsetX;
      let zPos = objectInfo.position.z + row + offsetZ;

      let groundHeight = getGroundHeight(
        xPos + objectInfo.position.x,
        zPos + objectInfo.position.z,
      );

      if (groundHeight <= waterLevel - 2.3) {
        groundHeight = -10000;
      }

      if (groundHeight >= maxGrassLevel + Math.random() * 8) {
        groundHeight = -10000;
      }

      let grassSize = Math.max(
        0.5,
        Math.min(1, (groundHeight - (waterLevel - 2.3)) * 3),
      );

      mock.position.set(xPos, objectInfo.position.y + groundHeight, zPos);
      mock.rotation.set(0, Math.random() * Math.PI, 0);
      mock.scale.set(grassSize, grassSize, grassSize);
      mock.updateMatrix();

      plane.setMatrixAt(i * localDensity + d, mock.matrix);
    }

    column++;
  }

  plane.instanceMatrix.needsUpdate = true;

  plane.receiveShadow = true;
  plane.castShadow = true;

  plane.position.x = objectInfo.position.x;
  plane.position.y = objectInfo.position.y;
  plane.position.z = objectInfo.position.z;

  plane.rotation.x = objectInfo.rotation.x;
  plane.rotation.y = objectInfo.rotation.y;
  plane.rotation.z = objectInfo.rotation.z;

  scene.add(plane);

  return plane;
}

// Create the grass

function loadGrass() {
  // Create grass

  //let startX = camera.position.x - (chunkDimensions / 2);
  //let startZ = camera.position.z - (chunkDimensions / 2);

  let startX = 0;
  let startZ = 0;

  for (let z = -viewDistance; z <= viewDistance; z++) {
    grassInstances.push([]);
    grassLODMap.push([]);

    for (let x = -viewDistance; x <= viewDistance; x++) {
      let LOD = 0;

      if (Math.abs(x) + Math.abs(z) > 2) {
        LOD = 1;
      }

      if (Math.abs(x) + Math.abs(z) > 4) {
        LOD = 2;
      }

      if (Math.abs(x) + Math.abs(z) > 6) {
        LOD = 3;
      }

      grassLODMap[z + viewDistance].push(LOD);

      grassInstances[z + viewDistance].push(
        createGrass({
          position: {
            x: startX + x * chunkDimensions * 0.5,
            y: 2,
            z: startZ + z * chunkDimensions * 0.5,
          },
          scale: {
            x: 4,
            y: 4,
          },
          rotation: {
            x: 0,
            y: 0,
            z: 0,
          },
          segments: {
            x: 1,
            y: 1,
          },
          LOD: LOD,
          colour: 0x33dd33,
          doubleSided: true,
        }),
      );
    }
  }
}

function updateGrass() {
  // Create grass

  let startX = 0;
  let startZ = 0;

  for (let z = -viewDistance; z <= viewDistance; z++) {
    for (let x = -viewDistance; x <= viewDistance; x++) {
      let globalX = startX + x * chunkDimensions * 0.5;
      let globalZ = startZ + z * chunkDimensions * 0.5;

      let globalXToCam = startX + x * chunkDimensions;
      let globalZToCam = startZ + z * chunkDimensions;

      let xDistance = Math.floor(
        Math.abs(globalXToCam - camera.position.x) / chunkDimensions,
      );
      let zDistance = Math.floor(
        Math.abs(globalZToCam - camera.position.z) / chunkDimensions,
      );

      let LOD = 0;

      if (xDistance + zDistance > 2) {
        LOD = 1;
      }

      if (xDistance + zDistance > 4) {
        LOD = 2;
      }

      if (xDistance + zDistance > 6) {
        LOD = 3;
      }

      if (grassLODMap[z + viewDistance][x + viewDistance] != LOD) {
        scene.remove(grassInstances[z + viewDistance][x + viewDistance]);

        grassLODMap[z + viewDistance][x + viewDistance] = LOD;

        grassInstances[z + viewDistance][x + viewDistance] = createGrass({
          position: {
            x: globalX,
            y: 2,
            z: globalZ,
          },
          scale: {
            x: 4,
            y: 4,
          },
          rotation: {
            x: 0,
            y: 0,
            z: 0,
          },
          segments: {
            x: 1,
            y: 1,
          },
          LOD: LOD,
          colour: 0x33dd33,
          doubleSided: true,
        });
      }
    }
  }
}

function animatePlants(delta) {
  grassUniforms.time.value = clock.getElapsedTime();
  grassMaterial.uniformsNeedUpdate = true;
}

// UI Controller

function updateUI(delta) {
  UIManager.FPS.innerText = "FPS:" + Math.round(1 / delta);

  if (
    player.gun.guns[player.gun.selectedGun].reloadCounter < player.gun.guns[player.gun.selectedGun].reloadTime &&
    player.gun.guns[player.gun.selectedGun].isReloading
  ) {
    player.gun.guns[player.gun.selectedGun].reloadCounter += delta;
  } else if (player.gun.guns[player.gun.selectedGun].reloadCounter < 100000 && player.gun.guns[player.gun.selectedGun].isReloading) {
    player.gun.guns[player.gun.selectedGun].ammo = player.gun.guns[player.gun.selectedGun].maxAmmo;
    player.gun.guns[player.gun.selectedGun].reloadCounter = 100001;

    player.gun.guns[player.gun.selectedGun].isReloading = false;
  }

  UIManager.ammo.innerText = player.gun.guns[player.gun.selectedGun].ammo;
  UIManager.maxAmmo.innerText = player.gun.guns[player.gun.selectedGun].maxAmmo;

  UIManager.health.value = player.health;
  UIManager.stamina.value = player.stamina;

  UIManager.reload.value =
    (player.gun.guns[player.gun.selectedGun].reloadCounter / player.gun.guns[player.gun.selectedGun].reloadTime) * 100;

  // Update leaderboard

  document.getElementById("leaderboard").innerHTML = "<div>Name : Kills</div>";

  for (let key in multiplayer.scores) {
    if (multiplayer.scores[key] != null) {
      let container = document.createElement("div");
      container.innerText =
        multiplayer.scores[key].name + " : " + multiplayer.scores[key].kills;

      document.getElementById("leaderboard").appendChild(container);
    }
  }

  // Add on local player

  let container = document.createElement("div");
  container.innerText = player.name + " : " + player.kills;

  document.getElementById("leaderboard").appendChild(container);
}

function setupSettings() {
  // Setup antialising
  if (localStorage.getItem("antialiasing") == "0") {
    document.getElementById("antialiasing").checked = false;
  }

  // Setup saved resolution
  document.getElementById("resolution").value =
    localStorage.getItem("resolution") || 1;

  renderer.setPixelRatio(
    window.devicePixelRatio *
      Number(document.getElementById("resolution").value),
  );

  // Setup saved sensitivity
  document.getElementById("sensitivity").value =
    localStorage.getItem("sensitivity") || 0.002;

  PointerLockControls.mouseSense = Number(
    document.getElementById("sensitivity").value,
  );

  document.getElementById("antialiasing").addEventListener("click", (e) => {
    let isChecked = document.getElementById("antialiasing").checked;

    if (isChecked) {
      localStorage.setItem("antialiasing", "1");
    } else {
      localStorage.setItem("antialiasing", "0");
    }

    location.reload(true);
  });

  document.getElementById("resolution").addEventListener("change", (e) => {
    renderer.setPixelRatio(
      window.devicePixelRatio *
        Number(document.getElementById("resolution").value),
    );

    localStorage.setItem(
      "resolution",
      Number(document.getElementById("resolution").value),
    );
  });

  document.getElementById("sensitivity").addEventListener("change", (e) => {
    PointerLockControls.mouseSense = Number(
      document.getElementById("sensitivity").value,
    );

    localStorage.setItem(
      "sensitivity",
      Number(document.getElementById("sensitivity").value),
    );
  });

  document.getElementById("resetSettings").addEventListener("click", (e) => {
    localStorage.setItem("antialiasing", "1");

    localStorage.setItem("resolution", 1);

    localStorage.setItem("sensitivity", 0.002);

    location.reload(true);
  });
}

// Animation controller

let lastState = "";

function updateAnimations(state, delta) {
  if (lastState == "" && playerAnimations["static"]) {
    playerAnimations["static"].play();
    lastState = "static";
  }

  if (lastState != state && loadedActions >= 5) {
    if (lastState != "") {
      fadeToAction(playerAnimations[lastState], playerAnimations[state], 0.2);
    }

    //playerAnimations[lastState].stop();
    //playerAnimations[state].play();

    lastState = state;
  }

  player.mesh.rotation.order = "ZYX";
  player.pivot.rotation.order = "ZYX";
  camera.rotation.order = "YXZ";

  // Comment

  player.gun.guns[player.gun.selectedGun].currentRecoil -= delta * player.gun.guns[player.gun.selectedGun].recoilSpeed;

  if (player.gun.guns[player.gun.selectedGun].currentRecoil <= 0) player.gun.guns[player.gun.selectedGun].currentRecoil = 0;

  player.mesh.position.set(0, -0.4 - player.gun.guns[player.gun.selectedGun].currentRecoil, 7.05);
  player.mesh.rotation.x = 0;

  player.pivot.position.set(
    camera.position.x,
    camera.position.y,
    camera.position.z,
  );

  player.pivot.rotation.set(
    -camera.rotation.x + 3.1415 * 0.5 - player.gun.guns[player.gun.selectedGun].currentRecoil * 0.2,
    camera.rotation.y + 3.1415,
    0,
  );

  // Disable inactive gun models
  for (let i = 0; i < player.gun.guns.length; i++) {
    if (i != player.gun.selectedGun) {
      if (player.gun.guns[i].mesh != null) {
        player.gun.guns[i].mesh.visible = false;
      }
    } else {
      if (player.gun.guns[i].mesh != null) {
        player.gun.guns[i].mesh.visible = true;
      }
    }
  }

  if (player.gun.guns[player.gun.selectedGun].mesh != null) {
    let target = new THREE.Vector3();
    player.rightHand.getWorldPosition(target);

    player.gun.guns[player.gun.selectedGun].mesh.rotation.order = "ZYX";

    player.gun.guns[player.gun.selectedGun].mesh.position.set(3.5, 12, 3.5);
    player.gun.guns[player.gun.selectedGun].mesh.rotation.set(3.1415, 3.1415 * -0.5, 0);
    player.gun.guns[player.gun.selectedGun].mesh.rotateZ(0.2);

    //console.log(player.rightHand.position)
  }
}

function fadeToAction(currentAction, nextAction, duration) {
  currentAction.fadeOut(duration);

  nextAction
    .reset()
    .setEffectiveTimeScale(1)
    .setEffectiveWeight(1)
    .fadeIn(duration)
    .play();
}

// Change render scale on window size change

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Keyboard controlls

function processKeyboard(delta) {
  let isMoving = 0;
  let isRunning = 1;

  let speedPerSecond = speed;
  if (player.crouched) speedPerSecond *= player.crouchSpeedMultiplier;

  let actualSpeed = speed * delta;
  let actualSideSpeed = sideSpeed * delta;

  if (player.crouched) actualSpeed *= player.crouchSpeedMultiplier;
  if (player.crouched) actualSideSpeed *= player.crouchSpeedMultiplier;

  // Blend player crouch height
  if (player.crouched) player.crouchHeight = lerp(player.crouchHeight, 0.7, delta * 5);
  if (!player.crouched) player.crouchHeight = lerp(player.crouchHeight, 1, delta * 5);

  if (keyboard["c"] || keyboard["/"]) {
    player.crouched = true;
  } else {
    player.crouched = false;
  }

  if (keyboard["shift"] && !player.crouched) {
    if (player.stamina > 0) {
      actualSpeed *= runSpeedMultiplier;
      speedPerSecond *= runSpeedMultiplier;
      isRunning = 1.5;

      player.stamina -= player.staminaLoss * delta;
    }
  } else {
    if (player.stamina <= player.maxStamina) {
      player.stamina += player.staminaRegen * delta;
    } else {
      player.stamina = player.maxStamina;
    }
  }

  playerState = "static";

  if (!player.grounded) {
    // Maintain current velocity

    if (player.velocity.z != 0) {
      playerState = "strafe";
    }

    if (player.velocity.x < 0) {
      playerState = "backward";
    }

    if (player.velocity.x > 0) {
      playerState = "walk";
    }

    if (player.velocity.x > speed) {
      playerState = "run";
    }

    controls.moveForward(player.velocity.x * delta);
    controls.moveRight(player.velocity.z * delta);
  } else {
    player.velocity.z = 0;
    player.velocity.x = 0;

    if (keyboard["a"] || keyboard["arrowleft"]) {
      controls.moveRight(-actualSideSpeed);
      isMoving = 1;

      playerState = "strafe";

      player.velocity.z = -sideSpeed;
      if (player.crouched) player.velocity.z *= player.crouchSpeedMultiplier;
    }

    if (keyboard["d"] || keyboard["arrowright"]) {
      controls.moveRight(actualSideSpeed);
      isMoving = 1;

      playerState = "strafe";

      player.velocity.z = sideSpeed;
      if (player.crouched) player.velocity.z *= player.crouchSpeedMultiplier;
    }

    if (keyboard["s"] || keyboard["arrowdown"]) {
      controls.moveForward(-actualSpeed);
      isMoving = 1;

      playerState = "backward";

      player.velocity.x = -speedPerSecond;
    }

    if (keyboard["w"] || keyboard["arrowup"]) {
      controls.moveForward(actualSpeed);
      isMoving = 1;

      playerState = "walk";

      player.velocity.x = speedPerSecond;
    }
  }

  if (keyboard["rightClick"]) {
    zoomInFunction(70, 12);
  } else {
    zoomOutFunction(70, 12);
  }

  if (keyboard["r"] && !player.gun.guns[player.gun.selectedGun].isReloading && player.gun.guns[player.gun.selectedGun].ammo < player.gun.guns[player.gun.selectedGun].maxAmmo) {
    // Reload gun
    player.gun.guns[player.gun.selectedGun].reloadCounter = 0;
    player.gun.guns[player.gun.selectedGun].isReloading = true;

    player.gun.reloadAudio.currentTime = 0;
    player.gun.reloadAudio.play();
  }

  if (isRunning > 1 && (keyboard["w"] || keyboard["arrowup"]))
    playerState = "run";

  if (isMoving > 0 && player.grounded) {
    // Play footstep sounds

    player.footstepAudio.volume = 0.2;
    player.waterFootstepAudio.volume = 0.2;

    if (player.footstepAudio.paused) {
      if (
        getGroundHeight(camera.position.x, camera.position.z) >
        waterLevel - 2
      ) {
        // In water
        player.waterFootstepAudio.pause();

        player.footstepAudio.currentTime = 0;
        player.footstepAudio.play();
      }
    }

    if (player.waterFootstepAudio.paused) {
      if (
        getGroundHeight(camera.position.x, camera.position.z) <=
        waterLevel - 2
      ) {
        // In water
        player.waterFootstepAudio.currentTime = 0;
        player.waterFootstepAudio.play();

        player.footstepAudio.pause();
      }
    }

    if (isRunning > 1 && (keyboard["w"] || keyboard["arrowup"])) {
      player.footstepAudio.playbackRate = 2;
      player.waterFootstepAudio.playbackRate = 2;
    } else {
      player.footstepAudio.playbackRate = 1.25;
      player.waterFootstepAudio.playbackRate = 1.25;
    }
  } else {
    // Stop footstep sounds

    player.footstepAudio.currentTime = 0;
    player.footstepAudio.pause();

    player.waterFootstepAudio.currentTime = 0;
    player.waterFootstepAudio.pause();
  }

  // Head bob

  let tick = clock.getElapsedTime();

  let bobble = Math.abs(Math.sin(tick * 5 * isRunning) * 0.5) * isMoving * 1.5;
  cameraOffsetY = lerp(cameraOffsetY, bobble, 0.25);
}

function processJump(delta) {
  let groundHeightAtPosition = getGroundHeight(
    camera.position.x,
    camera.position.z,
  );

  if (!player.grounded) {
    player.velocity.y -= player.gravity * delta;
    camera.position.y += player.velocity.y * delta;

    if (camera.position.y - 10 * player.crouchHeight < groundHeightAtPosition) {
      camera.position.y = groundHeightAtPosition + 10 * player.crouchHeight;
      player.velocity.y = 0;

      player.grounded = true;
    }

    camera.position.y += cameraOffsetY;
  } else {
    camera.position.y = groundHeightAtPosition + (10 + cameraOffsetY) * player.crouchHeight;
  }

  if (keyboard[" "] && player.grounded) {
    // Jump
    player.velocity.y = player.jumpVelocity;
    player.grounded = false;
  }
}

function updateBalls(delta) {
  for (let i = 0; i < multiplayer.balls.length; i++) {
    let ball = multiplayer.balls[i];

    ball.velocity.y -= player.gravity * delta;

    ball.position.x += ball.velocity.x * delta;
    ball.position.z += ball.velocity.z * delta;
    ball.position.y += ball.velocity.y * delta;

    let hasCollided = false;

    // Check if ball has hit another player
    for (let key in multiplayer.playerHitboxes) {
      let otherPlayer = multiplayer.playerHitboxes[key];

      let firstBB = new THREE.Box3().setFromObject(ball);
      let secondBB = new THREE.Box3().setFromObject(otherPlayer);

      let collision = firstBB.intersectsBox(secondBB);

      if (collision) hasCollided = true;

      if (ball.ownerSocket == socket.id && collision) {
        socket.emit("hitPlayer", {
          roomID: player.room,
          hitPlayer: otherPlayer.ownerSocket,
          socketID: socket.id,
          distance: otherPlayer.position.distanceTo(camera.position),
          damage: player.gun.guns[player.gun.selectedGun].damage,
        });
      }
    }

    // Check if the ball hits the props
    for (let j = 1; j < player.gun.collidableObjects.length; j++) {
      let object = player.gun.collidableObjects[j];
      let firstBB = new THREE.Box3().setFromObject(ball);
      let secondBB = new THREE.Box3().setFromObject(object);

      let collision = firstBB.intersectsBox(secondBB);
      if (collision) hasCollided = true;
    }

    if (ball.position.y < -100 || hasCollided) {
      scene.remove(ball);
      multiplayer.balls.splice(i, 1);
      i--;
    }
  }
}

function lerp(a, b, alpha) {
  return a + alpha * (b - a);
}

window.addEventListener("keydown", (e) => {
  keyboard[e.key.toLowerCase()] = true;

  if (e.key == "e") player.gun.selectedGun = 1 - player.gun.selectedGun;
  if (e.key == "1") player.gun.selectedGun = 0;
  if (e.key == "2") player.gun.selectedGun = 1;
});

window.addEventListener("keyup", (e) => {
  keyboard[e.key.toLowerCase()] = false;
});

function setupMouseLook() {
  controls = new PointerLockControls(camera, renderer.domElement);

  renderer.domElement.addEventListener("mousedown", () => {
    controls.lock();
  });
}

// Events

window.addEventListener("resize", onWindowResize);

// Main Game Loop

function animate() {
  requestAnimationFrame(animate);

  let delta = clock.getDelta();

  if (player.hasLoadedIn) {
    processKeyboard(delta);
  } else {
    camera.position.z = -100 * Math.sin(clock.getElapsedTime() * 0.1);
    camera.position.y = 50;
    camera.position.x = 100 * Math.cos(clock.getElapsedTime() * 0.1);

    //camera.rotation.y = clock.getElapsedTime() * 0.1 + Math.PI / 1.5;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  }

  animatePlants(delta);
  updateBalls(delta);
  if (player.hasLoadedIn) processJump(delta);
  updateUI(delta);

  player.currentChunk = {
    x: Math.floor(camera.position.x / chunkDimensions),
    z: Math.floor(camera.position.z / chunkDimensions),
  };

  if (
    player.currentChunk.x != player.lastChunk.x ||
    player.currentChunk.z != player.lastChunk.z
  ) {
    player.lastChunk = player.currentChunk;
    updateGrass();
  }

  if (mixer != null) mixer.update(delta);
  if (mixer != null) updateAnimations(playerState, delta);

  for (let mixerLoc in multiplayer.mixers) {
    multiplayer.mixers[mixerLoc].update(delta);
  }

  // Communicate the data to the server

  if (player.hasLoadedIn) {
    socket.emit("position", {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      socketID: socket.id,
      kills: player.kills,
      name: player.name,
      health: player.health,
      rotation: camera.rotation.y,
      roomID: player.room,
      state: playerState,
      time: Date.now(),
    });
  }

  renderer.render(scene, camera);
}

init();
setupSettings();
setupMouseLook();
loadGrass();
loadTrees();
loadBushes();
//loadPlayer();
//loadWeapon();
animate();
