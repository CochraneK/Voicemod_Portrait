import { ICONS } from "./data.js";

const stateKey = "voicemod-avatar-state";
const backgroundDbName = "voicemod-avatar-assets";
const backgroundStoreName = "backgrounds";
const backgroundImageKey = "stage-background";
const els = {
  search: document.querySelector("#searchInput"),
  grid: document.querySelector("#avatarGrid"),
  stats: document.querySelector("#stats"),
  avatar: document.querySelector("#avatarImage"),
  avatarWrap: document.querySelector("#avatarWrap"),
  stageCard: document.querySelector("#stageCard"),
  avatarSelect: document.querySelector("#avatarSelect"),
  nowTitle: document.querySelector("#nowTitle"),
  micBtn: document.querySelector("#micBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  fullscreenBtn: document.querySelector("#fullscreenBtn"),
  bgMode: document.querySelector("#bgMode"),
  customBg: document.querySelector("#customBg"),
  backgroundImage: document.querySelector("#backgroundImage"),
  sensitivity: document.querySelector("#sensitivity"),
  sensitivityValue: document.querySelector("#sensitivityValue"),
  motion: document.querySelector("#motion"),
  motionValue: document.querySelector("#motionValue"),
  meterFill: document.querySelector("#meterFill"),
  micStatus: document.querySelector("#micStatus"),
};

let selectedIcon = ICONS[0];
let micLevel = 0;
let audioContext;
let analyser;
let micData;
let backgroundImageUrl = "";

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function saveState() {
  const payload = {
    avatarPath: selectedIcon.path,
    bgMode: els.bgMode.value,
    customBg: els.customBg.value,
    sensitivity: els.sensitivity.value,
    motion: els.motion.value,
  };
  localStorage.setItem(stateKey, JSON.stringify(payload));
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(stateKey) || "{}");
  } catch {
    return {};
  }
}

function openBackgroundDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(backgroundDbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(backgroundStoreName)) {
        request.result.createObjectStore(backgroundStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBackgroundImage(blob) {
  const db = await openBackgroundDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(backgroundStoreName, "readwrite");
    transaction.objectStore(backgroundStoreName).put(blob, backgroundImageKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function readBackgroundImage() {
  const db = await openBackgroundDb();
  const blob = await new Promise((resolve, reject) => {
    const request = db.transaction(backgroundStoreName, "readonly")
      .objectStore(backgroundStoreName)
      .get(backgroundImageKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

function useBackgroundImage(blob) {
  if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
  backgroundImageUrl = URL.createObjectURL(blob);
}

function backgroundValue() {
  const presets = {
    transparent: "transparent",
    green: "#00ff00",
    blue: "#0047ff",
    black: "#000000",
    white: "#ffffff",
  };
  return els.bgMode.value === "custom" ? els.customBg.value : (presets[els.bgMode.value] || "#000000");
}

function applyBackground() {
  const isTransparent = els.bgMode.value === "transparent";
  const isImage = els.bgMode.value === "image" && backgroundImageUrl;
  els.stageCard.classList.toggle("transparent-preview", isTransparent);

  if (isImage) {
    els.stageCard.style.backgroundColor = "#000000";
    els.stageCard.style.backgroundImage = `url("${backgroundImageUrl}")`;
    els.stageCard.style.backgroundPosition = "center";
    els.stageCard.style.backgroundRepeat = "no-repeat";
    els.stageCard.style.backgroundSize = "cover";
  } else {
    els.stageCard.style.background = backgroundValue();
    els.stageCard.style.backgroundImage = "";
    els.stageCard.style.backgroundPosition = "";
    els.stageCard.style.backgroundRepeat = "";
    els.stageCard.style.backgroundSize = "";
  }
  saveState();
}

function updateControlValues() {
  els.sensitivityValue.textContent = `${Number(els.sensitivity.value).toFixed(1)}x`;
  els.motionValue.textContent = `${Number(els.motion.value).toFixed(1)}x`;
}

function setMicStatus(label, mode = "") {
  els.micStatus.className = `mic-status ${mode}`.trim();
  els.micStatus.querySelector("strong").textContent = label;
}

async function toggleFullscreen() {
  if (document.fullscreenElement !== els.stageCard) {
    await els.stageCard.requestFullscreen();
    els.stageCard.classList.add("avatar-fullscreen");
    els.fullscreenBtn.textContent = "退出全屏";
    return;
  }
  await document.exitFullscreen();
  els.stageCard.classList.remove("avatar-fullscreen");
  els.fullscreenBtn.textContent = "全屏";
}

function filteredIcons() {
  const q = normalize(els.search.value);
  return ICONS.filter((icon) => !q || normalize(icon.name).includes(q));
}

function renderIcons() {
  const list = filteredIcons();
  els.stats.textContent = `显示 ${list.length} / ${ICONS.length} 个头像`;
  els.grid.innerHTML = list.map((icon) => `
    <button
      class="avatar-choice ${icon.path === selectedIcon.path ? "selected" : ""}"
      type="button"
      data-avatar="${escapeHtml(icon.path)}"
      title="${escapeHtml(icon.name)}"
    >
      <img src="${escapeHtml(icon.path)}" alt="${escapeHtml(icon.name)}" loading="lazy" />
      <span>${escapeHtml(icon.name)}</span>
    </button>
  `).join("");
}

function setAvatar(icon) {
  selectedIcon = icon;
  els.avatar.src = icon.path;
  els.avatar.alt = icon.name;
  els.avatarSelect.value = icon.path;
  els.nowTitle.textContent = icon.name;
  saveState();
  renderIcons();
}

function setEnergy(level) {
  const motion = Number(els.motion.value);
  const energy = Math.min(1, Math.max(0, level));
  const scale = 1 + energy * 0.065 * motion;
  const lift = -energy * 7 * motion;
  els.avatarWrap.style.setProperty("--energy", energy.toFixed(3));
  els.avatarWrap.style.setProperty("--scale", scale.toFixed(3));
  els.avatarWrap.style.setProperty("--lift", `${lift.toFixed(1)}px`);
  els.avatarWrap.style.setProperty("--glow", (0.18 + energy * 0.7).toFixed(3));
  els.meterFill.style.width = `${Math.round(energy * 100)}%`;
}

async function startMic() {
  if (analyser) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  micData = new Uint8Array(analyser.fftSize);
  audioContext.createMediaStreamSource(stream).connect(analyser);
  els.micBtn.textContent = "麦克风已开";
  els.micBtn.disabled = true;
  setMicStatus("麦克风驱动中", "active");
  tickMic();
}

function tickMic() {
  if (!analyser) return;
  analyser.getByteTimeDomainData(micData);
  let sum = 0;
  for (const value of micData) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / micData.length);
  const target = Math.min(1, rms * Number(els.sensitivity.value) * 7);
  micLevel = micLevel * 0.78 + target * 0.22;
  setEnergy(micLevel);
  requestAnimationFrame(tickMic);
}

async function init() {
  const saved = readState();
  els.avatarSelect.innerHTML = ICONS
    .map((icon) => `<option value="${escapeHtml(icon.path)}">${escapeHtml(icon.name)}</option>`)
    .join("");

  if (saved.bgMode) els.bgMode.value = saved.bgMode;
  if (!saved.bgMode) els.bgMode.value = "black";
  if (saved.customBg) els.customBg.value = saved.customBg;
  if (saved.sensitivity) els.sensitivity.value = saved.sensitivity;
  if (saved.motion) els.motion.value = saved.motion;
  if (saved.bgMode === "image") {
    try {
      const storedImage = await readBackgroundImage();
      if (storedImage) useBackgroundImage(storedImage);
      if (!storedImage) els.bgMode.value = "black";
    } catch {
      els.bgMode.value = "black";
    }
  }
  updateControlValues();

  setAvatar(ICONS.find((icon) => icon.path === saved.avatarPath) || ICONS.find((icon) => icon.name === "Clean Mic") || ICONS[0]);

  els.search.addEventListener("input", renderIcons);
  els.avatarSelect.addEventListener("change", () => {
    const icon = ICONS.find((item) => item.path === els.avatarSelect.value) || ICONS[0];
    setAvatar(icon);
  });
  els.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-avatar]");
    if (!button) return;
    const icon = ICONS.find((item) => item.path === button.dataset.avatar) || ICONS[0];
    setAvatar(icon);
  });
  els.micBtn.addEventListener("click", () => {
    startMic().catch(() => {
      els.micBtn.textContent = "麦克风权限被拒绝";
      setMicStatus("麦克风不可用", "error");
    });
  });
  els.resetBtn.addEventListener("click", () => setEnergy(0));
  els.bgMode.addEventListener("change", applyBackground);
  els.customBg.addEventListener("input", () => {
    els.bgMode.value = "custom";
    applyBackground();
  });
  els.backgroundImage.addEventListener("change", async () => {
    const file = els.backgroundImage.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    useBackgroundImage(file);
    els.bgMode.value = "image";
    applyBackground();

    try {
      await saveBackgroundImage(file);
    } catch {
      // The selected image still works for this session if local storage is unavailable.
    }
  });
  els.sensitivity.addEventListener("input", () => {
    updateControlValues();
    saveState();
  });
  els.motion.addEventListener("input", () => {
    updateControlValues();
    saveState();
  });
  els.fullscreenBtn.addEventListener("click", () => {
    toggleFullscreen().catch(() => {
      els.fullscreenBtn.textContent = "全屏失败";
    });
  });
  document.addEventListener("fullscreenchange", () => {
    const isAvatarFullscreen = document.fullscreenElement === els.stageCard;
    els.stageCard.classList.toggle("avatar-fullscreen", isAvatarFullscreen);
    els.fullscreenBtn.textContent = isAvatarFullscreen ? "退出全屏" : "全屏";
  });
  applyBackground();
  startMic().catch(() => {
    els.micBtn.disabled = false;
    els.micBtn.textContent = "点击授权麦克风";
    setMicStatus("等待麦克风授权");
  });
}

init().catch(() => {
  els.micBtn.textContent = "页面初始化失败";
});
