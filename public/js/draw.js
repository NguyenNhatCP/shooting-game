const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ================= STATE =================
let players = {};
let bullets = [];
let fireZones = [];
let walls = [];
let weaponDrops = [];
let hitEffects = [];
let manaDrops = [];
let bombs = [];
let explosions = [];
let healDrops = [];
let shake = 0;
let stunEffects = [];
let zombies = [];
let clawAnims = [];
let spinFX = [];
let pullFX = [];
let pulledState = {}; 
let webs = [];
let burnEffects = [];
let started = false;
let chatting = false;

// ================= IMAGES =================
const characterImages = {
  soldier: new Image(),
  tank: new Image(),
  assassin: new Image(),
  hung: new Image(),
  bomber: new Image()
};

characterImages.soldier.src = "/assets/soldier.png";
characterImages.tank.src = "/assets/tank.png";
characterImages.assassin.src = "/assets/assassin.png";
characterImages.hung.src = "/assets/hung.png";
characterImages.bomber.src = "/assets/binh.png";
characterImages.ghost = new Image();
characterImages.ghost.src = "/assets/ghost.png";
characterImages.beauty = new Image();
characterImages.beauty.src = "/assets/beauty.png";
const slashImg = new Image();
slashImg.src = "/assets/slash.png";
const zombieImg = new Image();
zombieImg.src = "/assets/zombie.png";
const bulletImg = new Image();
bulletImg.src = "/assets/bullet.png";
const manaImg = new Image();
manaImg.src = "/assets/mana.png";
const wallImg = new Image();
wallImg.src = "/assets/wall.png"; // tường cứng
const bombImg = new Image();
bombImg.src = "/assets/bomb.png";
// Load ảnh Spider-Man
characterImages.spider = new Image();
characterImages.spider.src = "/assets/spider.png";
// const grassImg = new Image();
// grassImg.src = "/assets/grass.png";
const mineImg = new Image();
mineImg.src = "/assets/mine.png";
const fireImg = new Image();
let fireLoaded = false;

fireImg.onload = () => {
  fireLoaded = true;
};

fireImg.onerror = () => {
  console.error("🔥 load fire.png fail");
};

fireImg.src = "/assets/fire.png";
const woodImg = new Image();
woodImg.src = "/assets/wood.png"; // tường phá được
const weaponImages = {
  pistol: new Image(),
  rifle: new Image(),
  sniper: new Image(),
  shotgun: new Image(),
  heal: new Image()
};
const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
weaponImages.pistol.src = "/assets/pistol.png";
weaponImages.rifle.src = "/assets/rifle.png";
weaponImages.sniper.src = "/assets/sniper.png";
weaponImages.shotgun.src = "/assets/shotgun.png";
weaponImages.heal.src = "/assets/heal.png";

// ================= SAFE DRAW =================
function drawImg(img, x, y, w, h) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.fillStyle = "orange";
    ctx.fillRect(x, y, w, h);
  }
}
// ================= SELECT CHARACTER =================
// Gán trực tiếp vào window để HTML gọi được
window.select = function(type) {
  // 1. Lấy tên từ input
  const nameInput = document.getElementById("nameInput");
  const name = nameInput.value.trim() || "Player_" + Math.floor(Math.random() * 100);

  // 2. Gửi dữ liệu lên Server
  socket.emit("selectCharacter", {
    type: type,
    name: name
  });
  // 3. Xử lý UI
  const menu = document.getElementById("menu");
  if (menu) menu.style.display = "none";

  // 4. Hiện Game và HUD
  const gameContainer = document.getElementById("gameContainer");
  if (gameContainer) gameContainer.style.display = "block";

  const hud = document.getElementById("HUD");
  if (hud) hud.style.display = "flex";

  const lb = document.getElementById("leaderboard");
  if (lb) lb.style.display = "block";

  // 5. Quan trọng: Cập nhật trạng thái bắt đầu
  started = true;
  
  // Ép focus vào canvas để nhận phím di chuyển ngay lập tức
  canvas.focus();
  
  console.log("Game Started từ draw.js: ", type, name);
};
// ================= CHAT INPUT =================
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chatInput.value.trim() !== "") {
    socket.emit("chat", chatInput.value);
    chatInput.value = "";
  }
});
chatInput.addEventListener("focus", () => {
  chatting = true;
});

chatInput.addEventListener("blur", () => {
  chatting = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("profile").classList.add("hidden");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!chatting) {
      chatInput.focus();
    }
  }
  if (e.key === "f") {
    socket.emit("assassinSpin");
  }
  if (e.key === "q") {
    socket.emit("spiderAttack");
  }
  if (e.key === "Escape") {
    chatInput.blur();
  }
});
// ================= INPUT (FIXED) =================
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener("keydown", (e) => {
  if (chatting) return;

  // 🥷 E để hóa trang
  if (e.key.toLowerCase() === "e") {
    socket.emit("disguise");
  }

  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
document.addEventListener("keydown", (e) => {
  if (chatting) return;
  const k = e.key.toLowerCase();

  if (k in keys) keys[k] = true;
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();

  if (k in keys) keys[k] = false;
});
window.addEventListener("blur", () => {
  // Reset tất cả phím về false khi người chơi click ra ngoài trình duyệt
  keys.w = keys.a = keys.s = keys.d = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "1") {
    socket.emit("changeMap", "city");
  }

  if (e.key === "2") {
    socket.emit("changeMap", "forest");
  }

  if (e.key === "3") {
    socket.emit("changeMap", "desert");
  }

  if (e.key === "4") {
    socket.emit("changeMap", "volcano");
  }
});
// 1. Chỉ lắng nghe các phím cần thiết
let canSkill = true;
document.addEventListener("keydown", (e) => {
  if (chatting) return;
  // keys[e.key.toLowerCase()] = true;

  // Đặt bom (giữ nguyên logic của bạn)
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    socket.emit("placeBomb");
  }
  if (e.key === "r") {
    socket.emit("bomberPull");
  }
  // 🥷 SKILL TÀNG HÌNH
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (!canSkill) return;

    socket.emit("skill");
    canSkill = false;

    setTimeout(() => {
      canSkill = true;
    }, 3000);
  }
});
window.addEventListener("blur", () => {
  keys.w = keys.a = keys.s = keys.d = false;
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || chatting) return;

  const me = players[socket.id];
  // Nếu không còn trong list players, có thể mình đang là zombie
  if (!me) {
    socket.emit("claw"); // Thử gửi claw nếu là zombie chủ
    return;
  }

  // Nếu vẫn là player nhưng là class zombie (tùy logic game của bạn)
  if (me.type === "zombie") {
    socket.emit("claw");
  } else {
    shoot(e);
  }
});
function shoot(e) {
  const me = players[socket.id];
  if (!me) return;

  const rect = canvas.getBoundingClientRect();

  let dx = e.clientX - rect.left - me.x;
  let dy = e.clientY - rect.top - me.y;

  let len = Math.hypot(dx, dy) || 1;
  socket.emit("shoot", {
    dx: dx / len,
    dy: dy / len,
    type: me.type
  });
}
// ================= SOCKET =================
socket.on("clawAnimation", (data) => {
  clawAnims.push({
    x: data.x + 20, // Căn chỉnh vào tâm
    y: data.y + 20,
    angle: data.angle,
    life: 1.0
  });
});
socket.on("burnFX", data => {
  burnEffects.push({
    x: data.x,
    y: data.y,
    life: 300 // ms
  });
});
socket.on("assassinSpinFX", (data) => {
  spinFX.push({
    x: data.x,
    y: data.y,
    range: data.range,
    angle: 0,
    life: 20
  });
});
socket.on("chat", (data) => {
  const msg = document.createElement("div");
  msg.classList.add("chat-msg");

  msg.innerHTML = `
<span class="chat-name">${data.name}:</span>
<span class="chat-text">${data.message}</span>
`;

  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});
socket.on("stunFX", (data) => {
  stunEffects.push({
    id: data.id,   // ⭐ THÊM DÒNG NÀY
    start: Date.now()
  });
});
socket.on("state", data => {
  players = data.players;
  bullets = data.bullets;
  fireZones = data.fireZones || [];
  walls = data.walls;
  weaponDrops = data.weaponDrops;
  manaDrops = data.manaDrops;
  bombs = data.bombs || [];
  healDrops = data.healDrops || [];
  zombies = data.zombies || [];
  webs = data.webs || [];
});
socket.on("breakWallFX", (data) => {
  explosions.push({
    x: data.x,
    y: data.y,
    radius: 25,
    life: 10
  });
});
socket.on("hitEffect", (data) => {
  if (data.damage === "K.O") {
    shake = 25; // Rung màn hình mạnh
    // Tạo thêm nhiều hạt máu
    for (let i = 0; i < 10; i++) {
      explosions.push({
        x: data.x + 16,
        y: data.y + 16,
        radius: Math.random() * 6 + 2,
        life: 15
      });
    }
  }

  hitEffects.push({
    x: data.x,
    y: data.y,
    damage: data.damage,
    life: 25
  });
});
socket.on("bomberPullFX", (data) => {
  pullFX.push({
    x: data.x,
    y: data.y,
    radius: data.radius * 0.5,
    life: 25
  });

  // 👇 làm tất cả player trong vùng bị "đơ"
  for (let id in players) {
    const p = players[id];
    const d = Math.hypot(p.x - data.x, p.y - data.y);

    if (d < data.radius) {
      pulledState[id] = Date.now() + 800; // đơ 0.8s
    }
  }

  shake = 10;
});
socket.on("explosionFX", (data) => {
  explosions.push({
    x: data.x,
    y: data.y,
    radius: 60,
    life: 15
  });
});
socket.on("mapChanged", (data) => {
  walls = data.walls;
  const me = players[socket.id];
  if (me) {
    // teleport về vị trí an toàn
    const pos = getSafePosition();
    me.x = pos.x;
    me.y = pos.y;
  }
});
const lbList = document.getElementById("lbList");

socket.on("state", (state) => {
  const playersArr = state.players;
  let list = Object.values(playersArr);
  list.sort((a, b) => (b.score || 0) - (a.score || 0));
  list = list.slice(0, 5);

  // Cập nhật lại HTML cho Leaderboard kèm sự kiện click
  lbList.innerHTML = list.map((p, i) => `
      <div onclick="viewPlayerProfile('${p.id}')" style="cursor: pointer; padding: 2px; transition: 0.2s;" onmouseover="this.style.color='gold'" onmouseout="this.style.color='white'">
          ${i + 1}. ${p.name} (${p.score || 0})
      </div>
  `).join("");
});
socket.on("scoreFX", (data) => {
  const p = players[data.id];
  if (!p) return;

  hitEffects.push({
    x: p.x,
    y: p.y,
    damage: `+${data.value}`,
    life: 30,
    type: "score"
  });
});
socket.on("rankUpFX", (data) => {
  const p = players[data.id];
  if (!p) return;

  // 💥 hiệu ứng nổ lớn
  explosions.push({
    x: p.x,
    y: p.y,
    radius: 100,
    life: 25
  });

  // 🎉 text bay lên
  hitEffects.push({
    x: p.x,
    y: p.y,
    damage: "RANK UP!",
    life: 30
  });
});
// ================= DRAW LOOP =================
function draw() {
  ctx.clearRect(0, 0, 800, 600);
  ctx.fillStyle = "#3fa34d";
  ctx.fillRect(0, 0, 800, 600);
  webs.forEach(w => {
    const owner = players[w.owner];
    if (owner) {
        ctx.save();
        
        // Vẽ sợi dây tơ
        ctx.beginPath();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.moveTo(owner.x + 16, owner.y + 16); // Từ Spider-Man
        ctx.lineTo(w.x, w.y);                   // Đến đầu tơ
        ctx.stroke();

        // Vẽ đầu tơ (cái chấm trắng)
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.arc(w.x, w.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
  });
  // WALLS
  // ctx.fillStyle = "gray";
  // walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));
  walls.forEach(w => {
    if (w.breakable) {
      drawImg(woodImg, w.x, w.y, w.w, w.h); // 🪵 wood
    } else {
      drawImg(wallImg, w.x, w.y, w.w, w.h); // 🧱 tường cứng
    }
  });
  burnEffects.forEach(e => {
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(e.x + 16, e.y + 16, 10, 0, Math.PI * 2);
    ctx.fill();
  
    e.life -= 16;
  });
  
  burnEffects = burnEffects.filter(e => e.life > 0);
  // 🔥 VẼ LAVA
  let time = Date.now() * 0.005;

  fireZones.forEach((z, i) => {
    if (!fireLoaded) return;
  
    const baseSize = z.radius * 2;
  
    // dùng sin → mượt
    const offsetX = Math.sin(time + i) * 1.5;
    const offsetY = Math.cos(time + i) * 1.5;
  
    const size = baseSize + Math.sin(time * 2 + i) * 2;
  
    ctx.globalAlpha = 0.85 + Math.sin(time * 3 + i) * 0.1;
  
    ctx.drawImage(
      fireImg,
      z.x - z.radius + offsetX,
      z.y - z.radius + offsetY,
      size,
      size
    );
  
    ctx.globalAlpha = 1;
  });
  // ================= HEAL DROPS =================
  healDrops.forEach(h => {
    drawImg(weaponImages.heal, h.x - 10, h.y - 10, 20, 20);

    ctx.fillStyle = "red";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("+", h.x, h.y + 3);
  });
  // ================= WEAPON DROPS =================
  weaponDrops.forEach(w => {
    drawImg(weaponImages[w.type], w.x - 10, w.y - 10, 20, 20);

    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(w.type.toUpperCase(), w.x, w.y + 18);
  });

  // ================= MANA DROPS =================
  manaDrops.forEach(m => {
    drawImg(manaImg, m.x - 10, m.y - 10, 20, 20);

    ctx.fillStyle = "cyan";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("+MANA", m.x, m.y + 18);
  });
  // 🌪️ vòng hút
  for (let i = pullFX.length - 1; i >= 0; i--) {
    const fx = pullFX[i];
    const alpha = fx.life / 25;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.arc(fx.x + 16, fx.y + 16, fx.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "white";
    ctx.arc(fx.x + 16, fx.y + 16, fx.radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    fx.life--;
    if (fx.life <= 0) pullFX.splice(i, 1);
  }
  // ================= VẼ HOẠT ẢNH MÓNG VUỐT 🧟 =================
  for (let i = clawAnims.length - 1; i >= 0; i--) {
    let anim = clawAnims[i];
    ctx.save();
    ctx.translate(anim.x, anim.y);
    ctx.rotate(anim.angle);
    ctx.globalAlpha = anim.life;

    ctx.strokeStyle = "#FF2200"; // Đỏ rực
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "red";

    // Vẽ 3 vệt cào cong (Bezier)
    for (let j = -1; j <= 1; j++) {
      let offset = j * 10;
      ctx.beginPath();
      ctx.moveTo(offset - 10, -15);
      ctx.quadraticCurveTo(offset + 5, 0, offset - 10, 15);
      ctx.stroke();
    }
    ctx.restore();

    anim.life -= 0.07; // Tốc độ biến mất
    if (anim.life <= 0) clawAnims.splice(i, 1);
  }
  // ================= ZOMBIES =================
  zombies.forEach(z => {
    const t = Date.now() * 0.004;

    const wobbleX = Math.sin(t + z.id.length) * 3;
    const wobbleY = Math.cos(t + z.id.length) * 3;

    // glow shadow
    ctx.save();
    ctx.shadowColor = "green";
    ctx.shadowBlur = 12;

    drawImg(
      zombieImg,
      z.x - 25 + wobbleX,
      z.y - 25 + wobbleY,
      50,
      50
    );

    ctx.restore();

    // HP BAR BACK
    ctx.fillStyle = "black";
    ctx.fillRect(z.x - 18, z.y - 28, 36, 5);

    // HP BAR FILL
    ctx.fillStyle = "#00ff66";
    ctx.fillRect(z.x - 18, z.y - 28, (z.hp / 60) * 36, 5);

    // NAME / ICON
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🧟 Zombie", z.x, z.y + 28);
  });
  // ================= BOMBS =================
  for (let i = 0; i < bombs.length; i++) {
    let b = bombs[i];
    if (!b) continue;
    // 👇 mỹ nữ glow nhẹ
    if (b.type === "beauty") {
      ctx.shadowColor = "pink";
      ctx.shadowBlur = 10;
    }
    // 👻 mine tàng hình với người khác
    if (b.type === "mine" && b.owner !== socket.id) continue;

    const img = b.type === "mine" ? mineImg : bombImg;

    drawImg(img, b.x - 12, b.y - 12, 24, 24);

    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(b.armed ? "💥" : "⏳", b.x, b.y + 18);
  }
  // PLAYERS
  for (let id in players) {
    let p = players[id];
    if (!p) continue;
    const isMe = id === socket.id;
    const isGhostStealth = p.type === "ghost" && p.invisible;

    // 👻 NGƯỜI KHÁC: KHÔNG THẤY LUÔN
    if (isGhostStealth && !isMe) continue;

    ctx.save();
    // 👻 CHỈ CHÍNH MÌNH thấy mờ
    if (isGhostStealth && isMe) {
      ctx.globalAlpha = 0.35;
    }
    // shadow
    if (!p.isDisguised) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.arc(p.x + 16, p.y + 34, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // character
    const SIZE = 40; // 👈 bằng tile map

    if (p.isDisguised && p.disguiseType) {
      const img = p.disguiseType === "wood" ? woodImg : wallImg;
      drawImg(img, p.x, p.y, SIZE, SIZE);
    } else {
      drawImg(characterImages[p.type], p.x, p.y, SIZE, SIZE);
    }
    if (!p.isDisguised) {
      // name
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;

      // NAME
      ctx.strokeText(p.name, p.x + 16, p.y - 18);
      ctx.fillText(p.name, p.x + 16, p.y - 18);

      // RANK
      ctx.font = "bold 10px Arial";
      ctx.fillStyle = getRankColor(p.rank);
      ctx.fillText(`🏆 ${p.rank}`, p.x + 16, p.y - 30);

      // HP
      let hpPercent = Math.max(0, p.hp / 180);

      ctx.fillStyle = "black";
      ctx.fillRect(p.x, p.y - 12, 34, 5);

      ctx.fillStyle = "lime";
      ctx.fillRect(p.x, p.y - 12, 34 * hpPercent, 5);
      ctx.restore();
      // MANA
      let manaPercent = Math.max(0, (p.weaponMana ?? 0) / 100);

      ctx.fillStyle = "black";
      ctx.fillRect(p.x, p.y - 18, 34, 4);

      ctx.fillStyle = "cyan";
      ctx.fillRect(p.x, p.y - 18, 34 * manaPercent, 4);
      ctx.restore();
      // explosions
      for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];

        ctx.fillStyle = "rgba(255,150,0,0.3)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "orange";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius / 2, 0, Math.PI * 2);
        ctx.fill();
        e.life--;

        if (e.life <= 0) {
          explosions.splice(i, 1);
        }
      }
    }
    // weapon
    if (!p.isDisguised) {
      if (p.type === "bomber") {
        ctx.fillText("💣", p.x + 16, p.y - 2);
      }
      else if (p.type === "hung") {
        ctx.fillText("✨", p.x + 16, p.y - 2);
      }
      else {
        drawImg(weaponImages[p.weapon], p.x + 10, p.y + 8, 18, 18);
      }
    }
    let offsetX = 0;
    let offsetY = 0;

    if (shake > 0) {
      offsetX = (Math.random() - 0.5) * 10;
      offsetY = (Math.random() - 0.5) * 10;
      shake--;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.restore();
  }
  // ================= STUN EFFECT (CHIM BAY) =================
  stunEffects = stunEffects.filter(e => {
    const duration = 1500;
    const t = Date.now() - e.start;

    if (t > duration) return false;

    const p = players[e.id];
    if (!p) return false;

    const cx = p.x + 16;
    const cy = p.y - 8;

    const birdCount = 3;
    const radius = 14;

    for (let i = 0; i < birdCount; i++) {
      const angle = (t * 0.01) + (i * (Math.PI * 2 / birdCount));

      const bx = cx + Math.cos(angle) * radius;
      const by = cy + Math.sin(angle) * radius;

      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(bx - 4, by);
      ctx.lineTo(bx, by - 3);
      ctx.lineTo(bx + 4, by);
      ctx.stroke();
    }

    return true;
  });
  // ================= ASSASSIN SLASH FX =================
  for (let i = spinFX.length - 1; i >= 0; i--) {
    const fx = spinFX[i];

    const size = 35; // 🔥 nhỏ lại

    ctx.save();

    ctx.translate(fx.x + 16, fx.y + 16);
    ctx.rotate(fx.angle);

    ctx.globalAlpha = fx.life / 15;

    // 🌪️ vẽ image slash
    drawImg(
      slashImg,
      -size / 2,
      -size / 2,
      size,
      size
    );

    ctx.restore();

    // xoay nhẹ
    fx.angle += 0.4;

    fx.life--;

    if (fx.life <= 0) {
      spinFX.splice(i, 1);
    }
  }
  // BULLETS
  bullets.forEach(b => {
    let angle = Math.atan2(b.dy, b.dx);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);

    // ❤️ CHỈ beauty bắn tim
    if (b.type === "beauty") {
      ctx.fillStyle = "red";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "pink";
      ctx.shadowBlur = 10;

      ctx.fillText("❤️", 0, 0);
      ctx.shadowBlur = 0;
    }
    else {
      ctx.drawImage(bulletImg, -4, -4, 8, 8);
    }

    ctx.restore();
  });

  // HIT EFFECT (🔥 FIX: phải nằm trong draw loop)
  for (let i = hitEffects.length - 1; i >= 0; i--) {
    const e = hitEffects[i];

    // ❌ Ẩn hit nếu target đang tàng hình (trừ bản thân)
    const target = Object.values(players).find(p =>
      Math.hypot(p.x - e.x, p.y - e.y) < 30
    );
    if (target && target.invisible && target.id !== socket.id) continue;

    let power = Math.min(e.damage / 2, 40);

    // 💥 vòng hit (giữ lại)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,0,0,0.4)";
    ctx.arc(e.x + 16, e.y + 16, power, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 2;
    ctx.arc(e.x + 16, e.y + 16, power + 8, 0, Math.PI * 2);
    ctx.stroke();

    // 💢 ICON HIT
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.fillText("☠️", e.x + 16, e.y - e.life * 2);

    // 🔴 DAMAGE BAY LÊN
    ctx.fillStyle = "red";
    ctx.font = "bold 14px Arial";
    // ctx.fillText(`-${e.damage}`, e.x + 16, e.y - 20 - e.life * 2);
    if (typeof e.damage === "string") {

      // ⭐ SCORE
      if (e.type === "score") {
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 16px Arial";
      }

      // 🎉 RANK UP
      else {
        ctx.fillStyle = "yellow";
        ctx.font = "bold 16px Arial";
      }

      ctx.fillText(e.damage, e.x + 16, e.y - 20 - e.life * 2);

    } else {

      // 🔴 DAMAGE
      ctx.fillStyle = "red";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`-${e.damage}`, e.x + 16, e.y - 20 - e.life * 2);
    }
    // 🎬 giảm life để bay lên
    e.life--;
    e.y -= 0.5;

    if (e.life <= 0) {
      hitEffects.splice(i, 1);
    }
  }
  requestAnimationFrame(draw);
}
function update() {
  const dx =
    (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const dy =
    (keys.s ? 1 : 0) - (keys.w ? 1 : 0);

  // ⛔ bị hút thì không được di chuyển
  if (pulledState[socket.id] && Date.now() < pulledState[socket.id]) {
    return;
  }
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);

    socket.emit("input", {
      dx: dx / len,
      dy: dy / len
    });
  }
}
draw();
function loop() {
  if (started && !chatting) {
    update();
  }
  requestAnimationFrame(loop);
}
loop();
function updateHUDDiv() {
  const me = players[socket.id];
  if (!me) return;

  const hpMax = me.type === "tank" ? 200 : me.type === "assassin" ? 80 : 120;

  const hpPercent = Math.max(0, me.hp) / hpMax * 100;
  const manaPercent = Math.max(0, me.weaponMana ?? 0) / 100 * 100;

  document.getElementById("HPBar").style.width = hpPercent + "%";
  document.getElementById("ManaBar").style.width = manaPercent + "%";

  document.getElementById("WeaponInfo").innerText =
    `🔫 ${me.weapon.toUpperCase()}`;

  // ⭐ RANK
  document.getElementById("RankInfo").innerText =
    `🏆 ${me.rank} (${me.score})`;
}

// update HUD liên tục
setInterval(updateHUDDiv, 1000 / 30);
function getSafePosition() {
  return {
    x: Math.random() * 700 + 50,
    y: Math.random() * 500 + 50
  };
}
function getRankColor(rank) {
  switch (rank) {
    case "Bronze": return "#cd7f32";
    case "Silver": return "#c0c0c0";
    case "Gold": return "#ffd700";
    case "Diamond": return "#00e5ff";
    default: return "white";
  }
}// Hàm hiển thị profile với dữ liệu cụ thể
function showProfile(playerData) {
  if (!playerData) return;

  // 1. Đổ dữ liệu vào các thẻ
  document.getElementById("profileName").innerText = playerData.name;
  document.getElementById("profileType").innerText = playerData.type.toUpperCase();
  document.getElementById("profileRank").innerText = playerData.rank || "Bronze";
  
  // 2. Cập nhật màu sắc Rank (Sử dụng hàm getRankColor bạn đã có)
  const rankColor = getRankColor(playerData.rank);
  document.getElementById("profileRank").style.color = rankColor;
  
  // 3. Cập nhật điểm số
  document.getElementById("profileScore").innerText = playerData.score || 0;

  // 4. HIỆN PROFILE (Quan trọng: dùng style.display)
  const profileDiv = document.getElementById("profile");
  if (profileDiv) {
    profileDiv.style.display = "block";
  }
}
// Lắng nghe phím P để xem thông tin bản thân
document.addEventListener("keydown", (e) => {
  if (chatting) return;
  
  if (e.key.toLowerCase() === "p") {
      const me = players[socket.id];
      if (me) {
          showProfile(me);
      }
  }
});
window.closeProfile = function() {
    document.getElementById('profile').style.display = 'none';
    // Đưa focus về canvas để chơi tiếp được luôn
    canvas.focus(); 
};
  