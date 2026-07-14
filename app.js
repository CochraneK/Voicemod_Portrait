import { ICONS } from "./data.js";

const stateKey = "voicemod-avatar-state";
const backgroundDbName = "voicemod-avatar-assets";
const backgroundStoreName = "backgrounds";
const backgroundImageKey = "stage-background";
const colorCacheKey = "voicemod-avatar-color-sort-v1";
const els = {
  search: document.querySelector("#searchInput"),
  sortMode: document.querySelector("#sortMode"),
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
  driveModeButtons: document.querySelectorAll("[data-drive-mode]"),
  sensitivity: document.querySelector("#sensitivity"),
  sensitivityValue: document.querySelector("#sensitivityValue"),
  motion: document.querySelector("#motion"),
  motionValue: document.querySelector("#motionValue"),
  meterFill: document.querySelector("#meterFill"),
  micStatus: document.querySelector("#micStatus"),
};

let selectedIcon = ICONS[0];
let micLevel = 0;
let visualEnergy = 0;
let voiceState = "";
let loudUntil = 0;
let lastPeak = 0;
let audioContext;
let analyser;
let micData;
let backgroundImageUrl = "";
let colorSortPromise;
let colorMetrics = readColorMetrics();
let colorSortReady = ICONS.every((icon) => colorMetrics[icon.path]);

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
    driveMode: currentDriveMode(),
    sortMode: els.sortMode.value,
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

function readColorMetrics() {
  try {
    return JSON.parse(localStorage.getItem(colorCacheKey) || "{}");
  } catch {
    return {};
  }
}

function saveColorMetrics() {
  localStorage.setItem(colorCacheKey, JSON.stringify(colorMetrics));
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

function currentDriveMode() {
  return document.querySelector("[data-drive-mode].selected")?.dataset.driveMode || "stage1";
}

function setDriveMode(mode) {
  const nextMode = mode === "stage1" ? "stage1" : "stage2";
  els.driveModeButtons.forEach((button) => {
    const selected = button.dataset.driveMode === nextMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  micLevel = 0;
  visualEnergy = 0;
  lastPeak = 0;
  loudUntil = 0;
  setEnergy(0);
  saveState();
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

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation, lightness };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function analyzeIconColor(icon) {
  const image = await loadImage(icon.path);
  const canvas = document.createElement("canvas");
  const size = 36;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 24) continue;
    const pr = pixels[i];
    const pg = pixels[i + 1];
    const pb = pixels[i + 2];
    if (pr < 18 && pg < 18 && pb < 18) continue;
    r += pr;
    g += pg;
    b += pb;
    count += 1;
  }

  if (!count) return { hue: 0, saturation: 0, lightness: 0 };
  const hsl = rgbToHsl(r / count, g / count, b / count);
  return {
    hue: Number(hsl.hue.toFixed(2)),
    saturation: Number(hsl.saturation.toFixed(4)),
    lightness: Number(hsl.lightness.toFixed(4)),
  };
}

function colorMetric(icon) {
  return colorMetrics[icon.path] || { hue: 999, saturation: 0, lightness: 0 };
}

async function ensureColorSort() {
  if (colorSortReady) return;
  if (colorSortPromise) return colorSortPromise;

  colorSortPromise = Promise.all(ICONS.map(async (icon) => {
    if (!colorMetrics[icon.path]) {
      colorMetrics[icon.path] = await analyzeIconColor(icon);
    }
  })).then(() => {
    colorSortReady = true;
    saveColorMetrics();
  }).catch(() => {
    colorSortReady = true;
  }).finally(() => {
    colorSortPromise = null;
  });

  return colorSortPromise;
}

function sortedIcons(list) {
  if (els.sortMode.value !== "color") return list;
  return [...list].sort((a, b) => {
    const ca = colorMetric(a);
    const cb = colorMetric(b);
    return ca.hue - cb.hue
      || cb.saturation - ca.saturation
      || ca.lightness - cb.lightness
      || a.name.localeCompare(b.name);
  });
}

function filteredIcons() {
  const q = normalize(els.search.value);
  return sortedIcons(ICONS.filter((icon) => !q || normalize(icon.name).includes(q)));
}

function renderIcons() {
  const list = filteredIcons();
  const suffix = els.sortMode.value === "color" && !colorSortReady ? " · 正在计算颜色" : "";
  els.stats.textContent = `${list.length}个头像${suffix}`;
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

function setVoiceState(nextState) {
  if (voiceState === nextState) return;
  voiceState = nextState;
  els.stageCard.dataset.voiceState = nextState;
  els.avatarWrap.dataset.voiceState = nextState;
}

function setEnergy(level, rawLevel = level) {
  const motion = Number(els.motion.value);
  const energy = Math.min(1, Math.max(0, level));
  if (currentDriveMode() === "stage1") {
    const scale = 1 + energy * 0.065 * motion;
    const lift = -energy * 7 * motion;
    setVoiceState("stage1");
    els.avatarWrap.style.setProperty("--energy", energy.toFixed(3));
    els.avatarWrap.style.setProperty("--scale", scale.toFixed(3));
    els.avatarWrap.style.setProperty("--lift", `${lift.toFixed(1)}px`);
    els.avatarWrap.style.setProperty("--squash", "1.000");
    els.avatarWrap.style.setProperty("--tilt", "0deg");
    els.avatarWrap.style.setProperty("--glow", "0.22");
    els.meterFill.style.width = `${Math.round(energy * 100)}%`;
    return;
  }

  const rawEnergy = Math.min(1, Math.max(0, rawLevel));
  const now = performance.now();
  const peakKick = Math.max(0, rawEnergy - lastPeak);
  lastPeak = lastPeak * 0.9 + rawEnergy * 0.1;

  if (rawEnergy > 0.72 || peakKick > 0.2) loudUntil = now + 180;
  if (now < loudUntil) {
    setVoiceState("loud");
  } else if (energy > 0.11) {
    setVoiceState("talking");
  } else {
    setVoiceState("idle");
  }

  const stateBoost = voiceState === "loud" ? 1.35 : voiceState === "talking" ? 1.1 : 0.75;
  const scale = 1 + energy * 0.07 * motion * stateBoost;
  const lift = -energy * 8.5 * motion * stateBoost;
  const squash = voiceState === "loud" ? 1 - Math.min(0.045, energy * 0.045 * motion) : 1;
  const tilt = voiceState === "talking"
    ? Math.sin(now / 105) * energy * motion * 1.6
    : Math.sin(now / 900) * 0.45;

  els.avatarWrap.style.setProperty("--energy", energy.toFixed(3));
  els.avatarWrap.style.setProperty("--scale", scale.toFixed(3));
  els.avatarWrap.style.setProperty("--lift", `${lift.toFixed(1)}px`);
  els.avatarWrap.style.setProperty("--squash", squash.toFixed(3));
  els.avatarWrap.style.setProperty("--tilt", `${tilt.toFixed(2)}deg`);
  els.avatarWrap.style.setProperty("--glow", "0.22");
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
  let peak = 0;
  for (const value of micData) {
    const centered = Math.abs((value - 128) / 128);
    sum += centered * centered;
    if (centered > peak) peak = centered;
  }
  const rms = Math.sqrt(sum / micData.length);
  const sensitivity = Number(els.sensitivity.value);
  if (currentDriveMode() === "stage1") {
    const target = Math.min(1, rms * sensitivity * 7);
    micLevel = micLevel * 0.78 + target * 0.22;
    setEnergy(micLevel, target);
    requestAnimationFrame(tickMic);
    return;
  }

  const rmsTarget = Math.min(1, rms * sensitivity * 7.2);
  const peakTarget = Math.min(1, peak * sensitivity * 1.2);
  const target = Math.max(rmsTarget, peakTarget * 0.38);
  const attack = target > micLevel ? 0.42 : 0.08;
  const release = target > visualEnergy ? 0.3 : 0.055;
  micLevel += (target - micLevel) * attack;
  visualEnergy += (micLevel - visualEnergy) * release;
  setEnergy(visualEnergy, target);
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
  if (saved.sortMode) els.sortMode.value = saved.sortMode;
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
  setDriveMode(saved.driveMode || "stage1");

  setAvatar(ICONS.find((icon) => icon.path === saved.avatarPath) || ICONS.find((icon) => icon.name === "Clean Mic") || ICONS[0]);
  setEnergy(0);

  if (els.sortMode.value === "color") {
    ensureColorSort().then(renderIcons);
  }

  els.search.addEventListener("input", renderIcons);
  els.sortMode.addEventListener("change", async () => {
    saveState();
    renderIcons();
    if (els.sortMode.value === "color") {
      await ensureColorSort();
      renderIcons();
    }
  });
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
  els.resetBtn.addEventListener("click", () => {
    micLevel = 0;
    visualEnergy = 0;
    lastPeak = 0;
    loudUntil = 0;
    setEnergy(0);
  });
  els.driveModeButtons.forEach((button) => {
    button.addEventListener("click", () => setDriveMode(button.dataset.driveMode));
  });
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
