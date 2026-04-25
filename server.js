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
let fireZones = [];
let weaponDrops = [];
let manaDrops = [];
let bombs = [];
let zombies = [];

const W = 800;
const H = 600;
let healDrops = [];
let currentMap = "forest";

// ================= WEAPONS =================
const weapons = ["pistol", "rifle", "sniper", "shotgun"];

function randomWeapon() {
  return weapons[Math.floor(Math.random() * weapons.length)];
}
// ================= CHARACTERS =================
function getCharacter(type) {
  if (type === "tank") return { hp: 200, speed: 4, armor: 0.3, color: "green" };
  if (type === "assassin") return { hp: 80, speed: 8, color: "purple" };
  if (type === "hung") return { hp: 90, speed: 6, color: "orange" };
  if (type === "bomber") return { hp: 140, speed: 4, color: "orange" };
  if (type === "ghost") return { hp: 85, speed: 7, color: "black" };
  if (type === "beauty") return {
    hp: 100,
    speed: 7,
    color: "pink"
  };

  return { hp: 120, speed: 6, color: "blue" };
}

// ================= WALLS =================
const maps = {
  forest: {
    name: "Forest",
    generate: () => {
      let walls = [];
      const tile = 40;

      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 20; x++) {
          // viền
          if (x === 0 || y === 0 || x === 19 || y === 14) {
            walls.push({ x: x * tile, y: y * tile, w: tile, h: tile });
            continue;
          }
          // cây rải rác
          if (Math.random() < 0.12) {
            walls.push({
              x: x * tile,
              y: y * tile,
              w: tile,
              h: tile,
              breakable: true
            });
          }
        }
      }
      return walls;
    }
  },

  city: {
    name: "City",
    generate: () => {
      let walls = [];
      const tile = 40;

      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 20; x++) {

          if (x === 0 || y === 0 || x === 19 || y === 14) {
            walls.push({ x: x * tile, y: y * tile, w: tile, h: tile });
            continue;
          }

          // tường nhiều hơn, kiểu đô thị
          if (x % 2 === 0 && Math.random() < 0.35) {
            walls.push({
              x: x * tile,
              y: y * tile,
              w: tile,
              h: tile,
              breakable: false
            });
          }
        }
      }

      return walls;
    }
  },

  desert: {
    name: "Desert",
    generate: () => {
      let walls = [];
      const tile = 40;

      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 20; x++) {

          if (x === 0 || y === 0 || x === 19 || y === 14) {
            walls.push({ x: x * tile, y: y * tile, w: tile, h: tile });
            continue;
          }

          // ít cover hơn
          if (Math.random() < 0.05) {
            walls.push({
              x: x * tile,
              y: y * tile,
              w: tile,
              h: tile,
              breakable: true
            });
          }
        }
      }

      return walls;
    }
  }
};
let walls = [];
function generateMaze() {
  walls = [];
  const tile = 40;
  const cols = Math.floor(W / tile);
  const rows = Math.floor(H / tile);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // 1. Giữ nguyên viền ngoài
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) {
        walls.push({ x: x * tile, y: y * tile, w: tile, h: tile });
        continue;
      }

      // 2. Giữ nguyên các block cứng (không phá được)
      if (x % 3 === 0 && y % 3 === 0) {
        walls.push({ x: x * tile, y: y * tile, w: tile, h: tile });
        continue;
      }

      // 3. GIẢM TỈ LỆ TƯỜNG GỖ (Chỉnh từ 0.4 xuống 0.15)
      // 0.15 nghĩa là chỉ có 15% ô trống sẽ trở thành tường gỗ
      if (Math.random() < 0.10) { 
        walls.push({
          x: x * tile,
          y: y * tile,
          w: tile,
          h: tile,
          breakable: true
        });
      }
    }
  }
}

function clearSpawnArea() {
  const safeZones = [
    { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 },

    { x: 18, y: 1 }, { x: 17, y: 1 }, { x: 18, y: 2 },

    { x: 1, y: 13 }, { x: 1, y: 12 }, { x: 2, y: 13 },

    { x: 18, y: 13 }, { x: 17, y: 13 }, { x: 18, y: 12 }
  ];

  walls = walls.filter(w =>
    !safeZones.some(z =>
      w.x === z.x * 40 && w.y === z.y * 40
    )
  );
}

//generateMaze();
// clearSpawnArea();
// function loadMap(name) {
//   currentMap = name;
//   walls = maps[name].generate();
//   clearSpawnArea();

//    // reset world entities (QUAN TRỌNG)
//    bullets = [];
//    bombs = [];
//    grenades = [];
// }

// loadMap("forest"); 
// ================= COLLISION =================
// Cập nhật lại hàm collide để check chính xác hơn
function collide(x, y) {
  const radius = 14; // Bán kính va chạm (nhân vật 32x32 thì 14 là an toàn)

  return walls.some(w => {
    // Tìm điểm trên tường gần với tâm nhân vật nhất
    const closestX = Math.max(w.x, Math.min(x, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(y, w.y + w.h));

    const dx = x - closestX;
    const dy = y - closestY;

    // Khoảng cách từ tâm đến tường < bán kính => Va chạm
    return (dx * dx + dy * dy) < (radius * radius);
  });
}

// Cập nhật hàm tìm vị trí an toàn
function getSafePosition() {
  let x, y;
  let tries = 0;
  let safe = false;

  while (!safe && tries < 100) {
    // Random tọa độ (tránh sát mép bản đồ)
    x = 60 + Math.random() * (W - 120);
    y = 60 + Math.random() * (H - 120);

    // Kiểm tra xem vị trí này có đè lên tường không
    // Lưu ý: x, y ở đây đóng vai trò là TÂM nhân vật
    if (!collide(x, y)) {
      safe = true;
    }
    tries++;
  }

  // Trả về tọa độ góc trên-trái để vẽ (x - 16, y - 16)
  return { x: x - 16, y: y - 16 };
}
// ================= SAFE POSITION =================
// function getSafePosition() {
//   let x, y;
//   let tries = 0;

//   do {
//     x = 50 + Math.random() * (W - 100);
//     y = 50 + Math.random() * (H - 100);
//     tries++;
//   } while (collide(x, y) && tries < 50);

//   return { x, y };
// }
function spawnHeal() {
  const pos = getSafePosition();

  healDrops.push({
    id: Math.random().toString(36).substr(2, 9),
    x: pos.x,
    y: pos.y,
    value: 40
  });
}
function spawnZombie(x, y, ownerId = null) {
  zombies.push({
    id: Math.random().toString(36).substr(2, 9),
    x,
    y,
    hp: 120,
    speed: 5,
    damage: 8,
    owner: ownerId
  });
}
for (let i = 0; i < 2; i++) spawnHeal();
function spawnMana() {
  const pos = getSafePosition();

  manaDrops.push({
    id: Math.random().toString(36).substr(2, 9),
    x: pos.x,
    y: pos.y,
    value: 30
  });
}
for (let i = 0; i < 5; i++) spawnMana();
// ================= LOOT SPAWN =================
function spawnWeapon() {
  const pos = getSafePosition();

  weaponDrops.push({
    id: Math.random().toString(36).substr(2, 9),
    x: pos.x,
    y: pos.y,
    type: randomWeapon()
  });
}
for (let i = 0; i < 6; i++) spawnWeapon();
// ================= SOCKET =================
io.on("connection", (socket) => {

  const pos = getSafePosition();

  players[socket.id] = {
    id: socket.id,
    x: pos.x,
    y: pos.y,
    hp: 120,
    speed: 6,
    color: "blue",
    name: "Player_" + socket.id.slice(0, 4),
    type: "soldier",
    weapon: "pistol",
    isDisguised: false,
    disguiseType: null
  };
  socket.on("disguise", () => {
    const p = players[socket.id];
    if (!p) return;
  
    // toggle OFF
    if (p.isDisguised) {
      p.isDisguised = false;
      p.disguiseType = null;
      return;
    }
  
    // tìm tường gần
    let nearest = null;
    let minDist = 80;
  
    for (let w of walls) {
      let cx = w.x + w.w / 2;
      let cy = w.y + w.h / 2;
  
      let dist = Math.hypot((p.x + 16) - cx, (p.y + 16) - cy);
  
      if (dist < minDist) {
        minDist = dist;
        nearest = w;
      }
    }
  
    // nếu không có tường → random
    if (!nearest) {
      p.isDisguised = true;
      p.disguiseType = Math.random() < 0.5 ? "wood" : "wall";
      return;
    }
  
    // bật disguise theo tường
    p.isDisguised = true;
    p.disguiseType = nearest.breakable ? "wood" : "wall";
  });
  socket.on("changeMap", (name) => {
    if (!maps[name]) return;
  
    loadMap(name);
  
    // 🔥 CHO TẤT CẢ PLAYER RESET VỊ TRÍ AN TOÀN
    for (let id in players) {
      const pos = getSafePosition();
      players[id].x = pos.x;
      players[id].y = pos.y;
    }
  
    broadcastMap();
  
    io.emit("state", {
      players,
      bullets,
      bombs,
      walls,
      weaponDrops,
      manaDrops,
      healDrops
    });
  
    io.emit("chat", {
      name: "SYSTEM",
      message: "Map changed → " + name
    });
  });
  socket.on("selectCharacter", (data) => {
    console.log("SELECT:", data);
  
    const type = data.type;
    const name = (data.name || "Player").trim();
  
    const c = getCharacter(type);
  
    const old = players[socket.id] || {};
  
    const pos = getSafePosition();

    players[socket.id] = {
      ...old,
      x: pos.x,
      y: pos.y,
      hp: c.hp,
      speed: c.speed,
      color: c.color,
      name,
      type,
      weapon: randomWeapon(),
      weaponMana: old.weaponMana ?? 100,
      kills: 0,
      invisible: false,
      invisibleUntil: 0,
      score: 0,   // ⭐ điểm rank
      rank: "Wood",
      stunnedUntil: 0,
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
  socket.on("chat", (msg) => {
    const player = players[socket.id];
  
    io.emit("chat", {
      name: player?.name || "Player",
      message: msg
    });
  });
  socket.on("input", (data) => {
    const p = players[socket.id];
    // 🧟 Nếu KHÔNG còn player → thử điều khiển zombie
    if (!p) {
      const myZombie = zombies.find(z => z.owner === socket.id);

      if (!myZombie) return;

      const dx = data.dx || 0;
      const dy = data.dy || 0;

      let len = Math.hypot(dx, dy) || 1;

      myZombie.x += (dx / len) * myZombie.speed;
      myZombie.y += (dy / len) * myZombie.speed;

      return;
    }
    if (p.stunnedUntil && Date.now() < p.stunnedUntil) {
      return; // 🚫 bị choáng → không di chuyển
    }
    if (p.isDisguised) {
      const moving = Math.abs(data.dx) > 0 || Math.abs(data.dy) > 0;
    
      if (moving) {
        p.isDisguised = false;
      }
    }
    const dx = data.dx || 0;
    const dy = data.dy || 0;
    let speed = p.speed || 3;
  
    // thử di chuyển X trước
    let newX = p.x + dx * speed;
    let newY = p.y + dy * speed;
      // 👇 bị slow
    if (p.slowUntil && Date.now() < p.slowUntil) {
      speed *= 0.5;
    }
    // check X
    if (!collide(newX + 16, p.y + 16)) {
      p.x = newX;
    }
  
    // check Y
    if (!collide(p.x + 16, newY + 16)) {
      p.y = newY;
    }
  
    // chặn map
    p.x = Math.max(0, Math.min(800 - 32, p.x));
    p.y = Math.max(0, Math.min(600 - 32, p.y));
  });
  socket.on("claw", () => {
    // Tìm zombie mà người chơi này đang điều khiển
    const myZombie = zombies.find(z => z.owner === socket.id);
    if (!myZombie) return;

    // Tốc độ chạy cho Zombie (Cập nhật trực tiếp vào object zombie)
    myZombie.speed = 4.5; // Tăng từ mức bình thường lên cao

    // Cooldown cào (0.4 giây)
    if (myZombie.lastClaw && Date.now() - myZombie.lastClaw < 400) return;
    myZombie.lastClaw = Date.now();

    // Phát hoạt ảnh cào cho tất cả (ngay cả khi trượt)
    io.emit("clawAnimation", { 
        x: myZombie.x, 
        y: myZombie.y, 
        angle: Math.random() * Math.PI * 2 
    });

    for (let id in players) {
        const p = players[id];
        if (!p) continue;

        // Tính khoảng cách tâm-tâm
        const dist = Math.hypot((p.x + 16) - myZombie.x, (p.y + 16) - myZombie.y);

        if (dist < 45) { // Tầm cào
            // 💀 CHẠM LÀ CHẾT
            p.hp = 0;

            io.emit("hitEffect", {
                x: p.x,
                y: p.y,
                damage: "K.O" // Gửi text đặc biệt
            });

            // Biến thành zombie mới
            spawnZombie(p.x, p.y, id);
            delete players[id];
        }
    }
});
  socket.on("shoot", (data) => {
    const p = players[socket.id];
    if (!p) return;
    if (p.stunnedUntil && Date.now() < p.stunnedUntil) {
      return;
    }
    if (p.isDisguised) {
      p.isDisguised = false;
    }
    // chặn bắn nếu bomber
    if (p.type === "bomber") return;
    if (p.type === "ghost") {
      p.invisible = false;
    }
    let len = Math.hypot(data.dx, data.dy) || 1;
    let dx = data.dx / len;
    let dy = data.dy / len;
  
    let damage = 10;
    let speed = 10;
  
    // ================= MANA COST =================
    let manaCost = 10;

    if (p.weapon === "pistol") manaCost = 5;
    else if (p.weapon === "sniper") manaCost = 30;
    else if (p.weapon === "rifle") manaCost = 10;
    else if (p.weapon === "shotgun") manaCost = 10;
    
    // ❌ không đủ mana
    if (p.weaponMana < manaCost) return;
    
    // trừ mana
    p.weaponMana -= manaCost;
    if (p.weaponMana < 0) p.weaponMana = 0;
  
    // ================= DAMAGE =================
    if (p.weapon === "rifle") damage = 18;
    if (p.weapon === "sniper") { damage = 50; speed = 20; }
    if (p.weapon === "shotgun") damage = 12;
      // ===== MAGE SKILL =====
    if (p.type === "hung") {
      damage = 14;
      speed = 12;

      const cx = p.x + 16;
      const cy = p.y + 16;

      for (let i = -1; i <= 1; i++) {
        bullets.push({
          x: cx,
          y: cy,
          dx: dx + i * 0.1,
          dy: dy + i * 0.1,
          speed,
          damage,
          owner: socket.id,
          type: p.type 
        });
      }

      return; // 🚨 cực quan trọng: không chạy xuống dưới nữa
    }
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
          owner: socket.id,
          type: p.type 
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
        owner: socket.id,
        type: p.type 
      });
    }
  });
  socket.on("placeBomb", () => {
    const p = players[socket.id];
    if (!p) return;
  
    // 🔢 Giới hạn bomb (bomber nhiều hơn)
    const maxBombs = p.type === "bomber" ? 10 : 5;
  
    const myBombsCount = bombs.filter(b => b.owner === socket.id).length;
  
    if (myBombsCount >= maxBombs) return;
  
    // 💣 LOẠI BOM
    const isMine = p.type === "bomber";
  
    bombs.push({
      id: Math.random().toString(36).substr(2, 9),
  
      // 🎯 spawn từ tâm
      x: p.x + 16,
      y: p.y + 16,
  
      owner: socket.id,
  
      type: isMine ? "mine" : "bomb",
  
      // ⏱ kích hoạt nhanh hơn nếu là mine
      armTime: Date.now() + (isMine ? 800 : 2000),
  
      armed: false,
  
      // ⏳ chỉ bomb thường mới dùng timer nổ
      explodeTime: isMine ? null : Date.now() + 2000,

        // 🔥 expireTime
      expireTime: Date.now() + 15000 // 15 giây
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
  socket.on("state", data => {
    players = data.players;
  });
  socket.on("skill", () => {
    const p = players[socket.id];
    if (!p) return;
  
    // 👇 BEAUTY SKILL
    if (p.type === "beauty") {

      for (let id in players) {
        let target = players[id];
        if (!target || id === socket.id) continue;

        let dist = Math.hypot(p.x - target.x, p.y - target.y);

        if (dist < 120) {
          target.slowUntil = Date.now() + 2000; // chậm 2s
        }
      }

      return;
    }
    if (p.type !== "ghost") return;
  
    // cooldown đơn giản
    if (p.invisible && Date.now() < p.invisibleUntil) return;
  
    p.invisible = true;
    p.invisibleUntil = Date.now() + 3000; // 3 giây
  });
  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// ================= EXPLOSION =================
function explode(x, y, ownerId) {
  const range = 3;
  const tile = 40;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  applyExplosionDamage(x, y, ownerId);

  dirs.forEach(d => {
    for (let i = 1; i <= range; i++) {
      let tx = x + d.dx * i * tile;
      let ty = y + d.dy * i * tile;

      let hitWall = walls.find(w => w.x === tx && w.y === ty);

      if (hitWall) {
        if (hitWall.breakable) {
          walls = walls.filter(w => w !== hitWall);
          io.emit("breakWallFX", { x: tx, y: ty });
        }

        // ✔ CHỈ DAMAGE 1 LẦN RỒI DỪNG
        applyExplosionDamage(tx, ty, ownerId);
        break;
      }

      // ✔ chỉ lan khi KHÔNG có wall
      applyExplosionDamage(tx, ty, ownerId);
    }
  });

  io.emit("explosionFX", { x, y });
}
// ================= GAME LOOP =================
setInterval(() => {
  zombies.forEach(z => {
    let target = null;
    let minDist = 9999;
  
    const noPlayersLeft = Object.keys(players).length === 0;
  
    // ===== 🧠 CHỌN TARGET =====
    if (!noPlayersLeft) {
      // 🎯 target player (giữ nguyên)
      if (z.owner) return;
  
      for (let id in players) {
        let p = players[id];
        let d = Math.hypot(p.x - z.x, p.y - z.y);
  
        if (d < minDist) {
          minDist = d;
          target = p;
        }
      }
  
    } else {
      // 💀 KHÔNG CÒN PLAYER → zombie đánh nhau
  
      for (let other of zombies) {
        if (other === z) continue; // ❌ không tự đánh mình
  
        let d = Math.hypot(other.x - z.x, other.y - z.y);
  
        if (d < minDist) {
          minDist = d;
          target = other;
        }
      }
    }
  
    if (!target) return;
  
    // ===== 🚶 MOVE =====
    let dx = target.x - z.x;
    let dy = target.y - z.y;
    let len = Math.hypot(dx, dy) || 1;
  
    z.x += (dx / len) * z.speed;
    z.y += (dy / len) * z.speed;
  
    // ===== ⚔️ ATTACK =====
    if (minDist < 20) {

      // ⏱ cooldown 500ms
      if (z.lastHit && Date.now() - z.lastHit < 500) return;
      z.lastHit = Date.now();
    
      target.hp -= 10; // fix damage luôn = 10
  
      // 🎯 nếu target là player
      if (!noPlayersLeft) {
        if (target.hp <= 0) {
          const dead = target;
  
          zombies.push({
            id: Math.random().toString(36).substr(2, 9),
            x: dead.x,
            y: dead.y,
            hp: 120,
            speed: 2.5,
            damage: 10
          });
  
          const deadId = Object.keys(players).find(pid => players[pid] === target);
          delete players[deadId];
  
          io.emit("hitEffect", {
            x: dead.x,
            y: dead.y,
            damage: "ZOMBIFIED"
          });
        }
      } 
      // 💀 nếu target là zombie
      else {
        if (target.hp <= 0) {
          const index = zombies.indexOf(target);
          if (index !== -1) zombies.splice(index, 1);
      
          // 💪 EVOLVE (buff zombie thắng)
          z.hp += 20;
          z.damage += 2;
          z.speed += 0.2;
      
          // 🧱 giới hạn để không bị quá bá
          if (z.hp > 300) z.hp = 300;
          if (z.damage > 25) z.damage = 25;
          if (z.speed > 8) z.speed = 8;
      
          // ✨ hiệu ứng
          io.emit("hitEffect", {
            x: z.x,
            y: z.y,
            damage: "EVOLVE"
          });
        }
      }
    }
  });
  bullets = bullets.filter(b => {
    b.x += b.dx * b.speed;
    b.y += b.dy * b.speed;

    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H)
      return false;

    for (let i = 0; i < walls.length; i++) {
      let w = walls[i];
    
      const hit =
        b.x < w.x + w.w &&
        b.x > w.x &&
        b.y < w.y + w.h &&
        b.y > w.y;
    
      if (hit) {
    
        // 💥 NỔ KHI CHẠM TƯỜNG
        //explode(b.x, b.y);
    
        // 🧱 nếu là tường gỗ thì phá
        if (w.breakable) {
          walls.splice(i, 1);
        }
    
        return false; // xóa đạn
      }
    }
    // ===== HIT ZOMBIE =====
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];

      const dx = b.x - z.x;
      const dy = b.y - z.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 18) {
        z.hp -= b.damage;

        // ===== 💥 KNOCKBACK =====
        const kbForce = 10; // lực đẩy (tăng/giảm tùy cảm giác)

        let len = Math.hypot(b.dx, b.dy) || 1;

        z.x += (b.dx / len) * kbForce;
        z.y += (b.dy / len) * kbForce;
        io.emit("hitEffect", {
          x: z.x,
          y: z.y,
          damage: b.damage
        });

        // chết zombie
        if (z.hp <= 0) {
          zombies.splice(i, 1);

          // thưởng điểm cho player
          const killer = players[b.owner];
          if (killer) {
            killer.score += 10;
          }
        }

        return false; // đạn biến mất
      }
    }
    for (let id in players) {
      const p = players[id];
      if (!p || id === b.owner) continue;
    
      const px = p.x + 16;
      const py = p.y + 16;
    
      const dx = b.x - px;
      const dy = b.y - py;
    
      const dist = Math.hypot(dx, dy);
    
      if (dist < 18) {

        // 🎯 stun nếu là beauty
        if (b.type === "beauty") {
          p.stunnedUntil = Date.now() + 1500;
          io.emit("stunFX", {
            id: id,
            x: p.x,
            y: p.y
          });
        }
        // 🎭 LỘ NGUYÊN HÌNH KHI BỊ BẮN
        if (p.isDisguised) {
          p.isDisguised = false;
          p.disguiseType = null;
        }
        p.hp -= b.damage;
        let dmg = b.damage;

        if (p.type === "tank") {
          dmg = Math.floor(dmg * 0.7); // giảm 30% damage
        }
        
        p.hp -= dmg;
        io.emit("hitEffect", {
          x: p.x,
          y: p.y,
          damage: b.damage
        });
    
        if (p.hp <= 0) {
          const killer = players[b.owner];
          const victim = players[id];
        
          if (killer && id !== b.owner) {
            killer.kills = (killer.kills || 0) + 1;
        
            // ⭐ CỘNG ĐIỂM
            killer.score += 20;
            io.emit("scoreFX", {
              id: b.owner,
              value: 20
            });
            const oldRank = killer.rank;
            killer.rank = getRank(killer.score);
        
            // 🎉 hiệu ứng lên rank
            if (oldRank !== killer.rank) {
              io.emit("rankUpFX", {
                id: b.owner,
                rank: killer.rank
              });
            }
          }
        
          if (victim) {
            // 💀 TRỪ ĐIỂM
            victim.score = Math.max(0, victim.score - 10);
            victim.rank = getRank(victim.score);
          }
        
          bombs = bombs.filter(b => b.owner !== id);
          spawnZombie(p.x, p.y, id);
          delete players[id];
        }
    
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
      explode(g.x, g.y, g.owner);
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
        // ❗ HEAL ITEM
        if (w.type === "heal") {
          p.hp = Math.min(p.hp + 40, 180); // hồi máu
          weaponDrops.splice(i, 1);
          setTimeout(spawnWeapon, 3000);
          break;
        }
         // 🚫 CHẶN MAGE
        if (p.type === "hung") continue;
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
  for (let i = healDrops.length - 1; i >= 0; i--) {
    let h = healDrops[i];
  
    for (let id in players) {
      let p = players[id];
      if (!p) continue;
  
      let dist = Math.hypot(p.x - h.x, p.y - h.y);
  
      if (dist < 25) {
        p.hp = Math.min(p.hp + h.value, 180);
  
        healDrops.splice(i, 1);
        setTimeout(spawnHeal, 3000);
        break;
      }
    }
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    let b = bombs[i];
    if (!b) continue;
    // 💀 HẾT HẠN → XÓA
    if (Date.now() >= b.expireTime) {
      bombs.splice(i, 1);
      continue;
    }
    // kích hoạt
    if (!b.armed && Date.now() >= b.armTime) {
      b.armed = true;
    }
  
    // ===== MINE =====
    if (b.type === "mine") {
      if (!b.armed) continue;
  
      for (let id in players) {
        let p = players[id];
        if (!p) continue;
        if (p.invisible) continue;
        if (id === b.owner) continue;
  
        let dist = Math.hypot((p.x + 16) - b.x, (p.y + 16) - b.y);
  
        if (dist < 20) {
          explode(b.x, b.y, b.owner);
          bombs.splice(i, 1);
          continue; // 🔥 FIX QUAN TRỌNG
        }
      }
  
      continue;
    }
  
    // ===== BOMB =====
    if (b.type === "bomb") {
  
      if (Date.now() >= b.explodeTime) {
        explode(b.x, b.y, b.owner);
        bombs.splice(i, 1);
        continue; // 🔥 FIX
      }
  
      if (b.armed) {
        for (let id in players) {
          let p = players[id];
          if (!p) continue;
  
          let dist = Math.hypot((p.x + 16) - b.x, (p.y + 16) - b.y);
  
          if (dist < 20) {
            explode(b.x, b.y, b.owner);
            bombs.splice(i, 1);
            continue; // 🔥 FIX
          }
        }
      }
    }
  }
  // 🥷 TẮT TÀNG HÌNH KHI HẾT TIME
  for (let id in players) {
    let p = players[id];
    if (!p) continue;

    if (p.invisible && Date.now() > p.invisibleUntil) {
      p.invisible = false;
    }
  }
  io.emit("state", {
    players,
    bullets,
    grenades,
    fireZones,
    walls,
    weaponDrops,
    manaDrops,
    bombs,
    healDrops,
    zombies
  });

}, 1000 / 30);
function applyExplosionDamage(x, y, ownerId) {
  for (let id in players) {
    let p = players[id];
    if (!p) continue;

    let dist = Math.hypot(p.x - x, p.y - y);

    if (dist < 80) { // ✅ tăng range cho mượt hơn
      // ===== DAMAGE THEO KHOẢNG CÁCH =====
      let maxDamage = 20;
      let minDamage = 3;

      let damage = Math.max(minDamage, maxDamage - dist * 0.5);

      // ===== BALANCE THEO CLASS =====
      if (p.type === "tank") damage *= 0.7;
      if (p.type === "assassin") damage *= 1.2;
      if (p.type === "bomber") damage *= 0.85;

      damage = Math.floor(damage);

      p.hp -= damage;

      io.emit("hitEffect", {
        x: p.x,
        y: p.y,
        damage: damage
      });

      if (p.hp <= 0) {
        const killer = players[ownerId];
        const victim = players[id];
      
        if (killer && id !== ownerId) {
          killer.kills = (killer.kills || 0) + 1;
      
          killer.score += 20;
      
          const oldRank = killer.rank;
          killer.rank = getRank(killer.score);
      
          if (oldRank !== killer.rank) {
            io.emit("rankUpFX", {
              id: ownerId,
              rank: killer.rank
            });
          }
        }
      
        if (victim) {
          victim.score = Math.max(0, victim.score - 10);
          victim.rank = getRank(victim.score);
        }
      
        bombs = bombs.filter(b => b.owner !== id);
        delete players[id];
      }
    }
  }
  // ===== 💀 DAMAGE ZOMBIE =====
  for (let i = zombies.length - 1; i >= 0; i--) {
    let z = zombies[i];

    let dist = Math.hypot(z.x - x, z.y - y);

    if (dist < 80) {
      let damage = Math.max(3, 20 - dist * 0.5);

      z.hp -= damage;

      io.emit("hitEffect", {
        x: z.x,
        y: z.y,
        damage
      });

      if (z.hp <= 0) {
        zombies.splice(i, 1);

        // ⭐ thưởng điểm cho người đặt bomb
        const killer = players[ownerId];
        if (killer) {
          killer.score += 10;
        }
      }
    }
  }
}
function loadMap(name) {
  currentMap = name;
  walls = maps[name].generate();
  clearSpawnArea();

   // reset đồ trong map (quan trọng)
   bullets = [];
   bombs = [];
   grenades = [];
   weaponDrops = [];
   manaDrops = [];
   healDrops = []; 
   // 🔥 SPAWN LẠI LOOT SAU MAP CHANGE
  for (let i = 0; i < 6; i++) spawnWeapon();
  for (let i = 0; i < 5; i++) spawnMana();
  for (let i = 0; i < 2; i++) spawnHeal();
}
function broadcastMap() {
  io.emit("mapChanged", {
    name: currentMap,
    walls
  });
}
function getRank(score) {
  if (score >= 1000) return "Diamond";
  if (score >= 600) return "Gold";
  if (score >= 300) return "Silver";
  if (score >= 100) return "Bronze";
  return "Wood";
}
server.listen(3000, () => {
  console.log("http://localhost:3000");
});