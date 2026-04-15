const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let bullets = [];
let grenades = [];
let explosions = [];
let fireZones = [];
let weaponDrops = [];
let manaDrops = [];
let bombs = [];

const W = 800;
const H = 600;

// ================= WEAPONS =================
const weapons = ["pistol", "rifle", "sniper", "shotgun"];

function randomWeapon() {
  return weapons[Math.floor(Math.random() * weapons.length)];
}
function spawnMana() {
  manaDrops.push({
    id: Math.random().toString(36).substr(2, 9),
    x: 100 + Math.random() * 600,
    y: 100 + Math.random() * 400,
    value: 30
  });
}
for (let i = 0; i < 5; i++) spawnMana();
// ================= LOOT SPAWN =================
function spawnWeapon() {
  weaponDrops.push({
    id: Math.random().toString(36).substr(2, 9),
    x: 100 + Math.random() * 600,
    y: 100 + Math.random() * 400,
    type: randomWeapon()
  });
}

for (let i = 0; i < 6; i++) spawnWeapon();

// ================= CHARACTERS =================
function getCharacter(type) {
  if (type === "tank") return { hp: 180, speed: 4, color: "green" };
  if (type === "assassin") return { hp: 80, speed: 8, color: "purple" };
  return { hp: 120, speed: 6, color: "blue" };
}

// ================= WALLS =================
let walls = [
  { x: 0, y: 0, w: W, h: 10 },
  { x: 0, y: H - 10, w: W, h: 10 },
  { x: 0, y: 0, w: 10, h: H },
  { x: W - 10, y: 0, w: 10, h: H },

  { x: 200, y: 150, w: 400, h: 20 },
  { x: 200, y: 350, w: 400, h: 20 }
];

// ================= COLLISION =================
function collide(x, y) {
  return walls.some(w =>
    x < w.x + w.w &&
    x + 32 > w.x &&
    y < w.y + w.h &&
    y + 32 > w.y
  );
}

// ================= SOCKET =================
io.on("connection", (socket) => {

  players[socket.id] = {
    x: 100,
    y: 100,
    hp: 120,
    speed: 6,
    color: "blue",
    name: "Player_" + socket.id.slice(0, 4), // 🔥 FIX NAME
    type: "soldier",
    weapon: "pistol"
  };

  socket.on("selectCharacter", (data) => {
    console.log("SELECT:", data);
  
    const type = data.type;
    const name = (data.name || "Player").trim();
  
    const c = getCharacter(type);
  
    const old = players[socket.id] || {};
  
    players[socket.id] = {
      ...old, // 🔥 GIỮ MANA + STATE CŨ
  
      x: 100,
      y: 100,
      hp: c.hp,
      speed: c.speed,
      color: c.color,
  
      name,
      type,
  
      weapon: randomWeapon(),
  
      weaponMana: old.weaponMana ?? 100 // 🔥 KHÔNG RESET MANA
    };
  
    io.emit("state", {
      players,
      bullets,
      grenades,
      walls,
      weaponDrops,
      manaDrops
    });
  });
  socket.on("input", (data) => {
    const p = players[socket.id];
    if (!p) return;
  
    const dx = data.dx || 0;
    const dy = data.dy || 0;
  
    const speed = p.speed;
  
    const nx = p.x + dx * speed;
    const ny = p.y + dy * speed;
  
    // tránh jitter collision
    if (!collide(nx, ny)) {
      p.x += (nx - p.x) * 0.9;
      p.y += (ny - p.y) * 0.9;
    }
  });
  socket.on("shoot", (data) => {
    const p = players[socket.id];
    if (!p) return;
  
    let len = Math.hypot(data.dx, data.dy) || 1;
    let dx = data.dx / len;
    let dy = data.dy / len;
  
    let damage = 10;
    let speed = 10;
  
    // ================= MANA COST =================
    let manaCost = 10;

    if (p.weapon === "pistol") manaCost = 5;
    else if (p.weapon === "sniper") manaCost = 20;
    else if (p.weapon === "rifle") manaCost = 10;
    else if (p.weapon === "shotgun") manaCost = 10;
    
    // ❌ không đủ mana
    if (p.weaponMana < manaCost) return;
    
    // trừ mana
    p.weaponMana -= manaCost;
    if (p.weaponMana < 0) p.weaponMana = 0;
  
    // ================= DAMAGE =================
    if (p.weapon === "rifle") damage = 18;
    if (p.weapon === "sniper") { damage = 50; speed = 18; }
    if (p.weapon === "shotgun") damage = 12;
  
    // ================= SHOTGUN SPREAD =================
    if (p.weapon === "shotgun") {
      for (let i = -2; i <= 2; i++) {
        bullets.push({
          x: p.x,
          y: p.y,
          dx: dx + i * 0.08,
          dy: dy + i * 0.08,
          speed,
          damage,
          owner: socket.id
        });
      }
    } else {
      bullets.push({
        x: p.x,
        y: p.y,
        dx,
        dy,
        speed,
        damage,
        owner: socket.id
      });
    }
  });
  socket.on("placeBomb", () => {
    const p = players[socket.id];
    if (!p) return;
  
    bombs.push({
      id: Math.random().toString(36).substr(2, 9),
      x: p.x,
      y: p.y,
      owner: socket.id,
      armTime: Date.now() + 2000,   // 2 giây mới kích hoạt
      armed: false,
      explodeTime: Date.now() + 2000
    });
  });
  socket.on("grenade", (data) => {
    const p = players[socket.id];
    if (!p) return;

    let len = Math.hypot(data.dx, data.dy) || 1;

    grenades.push({
      x: p.x,
      y: p.y,
      dx: data.dx / len,
      dy: data.dy / len,
      speed: 6,
      explodeTime: Date.now() + 1200
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// ================= EXPLOSION =================
function explode(x, y) {
  explosions.push({ x, y });

  fireZones.push({
    x,
    y,
    radius: 70,
    start: Date.now(),
    duration: 4000
  });

  for (let id in players) {
    let p = players[id];
    if (!p) continue;

    let dist = Math.hypot(p.x - x, p.y - y);

    if (dist < 80) {
      p.hp -= 50;
      if (p.hp <= 0) delete players[id];
    }
  }
}

// ================= GAME LOOP =================
setInterval(() => {

  bullets = bullets.filter(b => {
    b.x += b.dx * b.speed;
    b.y += b.dy * b.speed;

    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H)
      return false;

    for (let w of walls) {
      if (b.x < w.x + w.w && b.x > w.x && b.y < w.y + w.h && b.y > w.y)
        return false;
    }

    for (let id in players) {
      const p = players[id];
      if (!p || id === b.owner) continue;

      if (Math.abs(b.x - p.x) < 15 && Math.abs(b.y - p.y) < 15) {
        p.hp -= b.damage;
        // 🔥 SEND HIT EFFECT
        io.emit("hitEffect", {
          x: p.x,
          y: p.y,
          damage: b.damage
        });

        if (p.hp <= 0) delete players[id];
        return false;
        }
    }

    return true;
  });

  grenades.forEach(g => {
    g.x += g.dx * g.speed;
    g.y += g.dy * g.speed;
  });

  grenades = grenades.filter(g => {
    if (Date.now() > g.explodeTime) {
      explode(g.x, g.y);
      return false;
    }
    return true;
  });

  fireZones.forEach(z => {
    for (let id in players) {
      let p = players[id];
      if (!p) continue;

      let dist = Math.hypot(p.x - z.x, p.y - z.y);

      if (dist < z.radius) {
        p.hp -= 0.3;
        if (p.hp <= 0) delete players[id];
      }
    }
  });

  fireZones = fireZones.filter(z =>
    Date.now() - z.start < z.duration
  );

  // weapon pickup
  for (let i = weaponDrops.length - 1; i >= 0; i--) {
    let w = weaponDrops[i];

    for (let id in players) {
      let p = players[id];
      if (!p) continue;

      let dist = Math.hypot(p.x - w.x, p.y - w.y);

      if (dist < 25) {
        p.weapon = w.type;
        weaponDrops.splice(i, 1);
        setTimeout(spawnWeapon, 3000);
        break;
      }
    }
  }
  for (let i = manaDrops.length - 1; i >= 0; i--) {
    let m = manaDrops[i];
  
    for (let id in players) {
      let p = players[id];
      if (!p) continue;
  
      let dist = Math.hypot(p.x - m.x, p.y - m.y);
  
      if (dist < 25) {
        p.weaponMana = Math.min(100, p.weaponMana + m.value);
  
        manaDrops.splice(i, 1);
  
        setTimeout(spawnMana, 3000); // respawn
        break;
      }
    }
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    let b = bombs[i];
  
    // 🔥 1. chưa kích hoạt
    if (!b.armed && Date.now() >= b.armTime) {
      b.armed = true;
    }
  
    // 🔥 2. đã kích hoạt → check player chạm vào
    if (b.armed) {
      for (let id in players) {
        let p = players[id];
        if (!p) continue;
  
        let dist = Math.hypot(p.x - b.x, p.y - b.y);
  
        if (dist < 25) {
          // 💥 EXPLODE
          for (let id2 in players) {
            let p2 = players[id2];
            let d2 = Math.hypot(p2.x - b.x, p2.y - b.y);
  
            if (d2 < 80) {
              p2.hp -= 60;
  
              io.emit("hitEffect", {
                x: p2.x,
                y: p2.y,
                damage: 60
              });
  
              if (p2.hp <= 0) delete players[id2];
            }
          }
  
          io.emit("explosionFX", { x: b.x, y: b.y });
  
          bombs.splice(i, 1);
          break;
        }
      }
    }
  }
  bombs = bombs.filter(b => {
    if (Date.now() > b.explodeTime) {
      explode(b.x, b.y);
      return false;
    }
    return true;
  });
  io.emit("state", {
    players,
    bullets,
    grenades,
    fireZones,
    walls,
    weaponDrops,
    manaDrops,
    bombs
  });

}, 1000 / 30);
function explode(x, y) {
  explosions.push({ x, y, radius: 60 });

  io.emit("shake");

  for (let id in players) {
    let p = players[id];
    let dist = Math.hypot(p.x - x, p.y - y);

    if (dist < 80) {
      p.hp -= 60;

      if (p.hp <= 0) delete players[id];
    }
  }
}
function select(type) {
  const name = document.getElementById("nameInput").value || "Player";

  socket.emit("selectCharacter", {
    type: type,
    name: name
  });

  document.getElementById("menu").style.display = "none";
  canvas.style.display = "block";
  started = true;
}
server.listen(3000, () => {
  console.log("http://localhost:3000");
});