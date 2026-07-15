import { ICONS } from "./data.js";
import { DICEBEER_ICONS } from "./dicebeer-data.js";
import { AIFACE_ICONS } from "./aiface-data.js";

const stateKey = "voicemod-avatar-state";
const customAvatarKey = "voicemod-custom-avatars-v1";
const customAvatarNameMigrationKey = "voicemod-custom-avatar-name-migration-v1";
const backgroundDbName = "voicemod-avatar-assets";
const backgroundStoreName = "backgrounds";
const backgroundImageKey = "stage-background";
const colorCacheKey = "voicemod-avatar-color-sort-v1";
const AIFACE_BATCH_SIZE = 60;
const VOICEMOD_ICONS = ICONS.map((icon, index) => ({
  ...icon,
  source: "voicemod",
  order: index + 1,
}));
const DICEBEER_SOURCE_ICONS = DICEBEER_ICONS.map((icon) => ({
  ...icon,
  source: "dicebeer",
}));
const AIFACE_SOURCE_ICONS = AIFACE_ICONS.map((icon) => ({
  ...icon,
  source: "aiface",
}));
const DEFAULT_CUSTOM_ICONS = Array.from({ length: 6 }, (_, index) => ({
  id: `default_custom_${index + 1}`,
  name: `avatar${index + 1}`,
  path: `./assets/custom/avatar${index + 1}.png`,
  source: "custom",
  order: index + 1,
  builtIn: true,
}));
const dicebeerStyleOrder = [...new Set(DICEBEER_SOURCE_ICONS.map((icon) => icon.style))];
let customIcons = readCustomIcons();
const els = {
  search: document.querySelector("#searchInput"),
  sourceMode: document.querySelector("#sourceMode"),
  sortMode: document.querySelector("#sortMode"),
  libraryTools: document.querySelector("#libraryTools"),
  customAvatarPicker: document.querySelector("#customAvatarPicker"),
  customAvatarPickerText: document.querySelector("#customAvatarPickerText"),
  customAvatarInput: document.querySelector("#customAvatarInput"),
  loadMoreBtn: document.querySelector("#loadMoreBtn"),
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
  scrollTopBtn: document.querySelector("#scrollTopBtn"),
  scrollResourcesBtn: document.querySelector("#scrollResourcesBtn"),
  resourceSection: document.querySelector(".resource-section"),
};

let selectedIcon = VOICEMOD_ICONS[0];
let micLevel = 0;
let visualEnergy = 0;
let voiceState = "";
let customContextPath = "";
let customRenamePath = "";
let aifaceVisibleCount = AIFACE_BATCH_SIZE;
let loudUntil = 0;
let lastPeak = 0;
let audioContext;
let analyser;
let micData;
let backgroundImageUrl = "";
let colorSortPromise;
let colorMetrics = readColorMetrics();
let colorSortReady = VOICEMOD_ICONS.every((icon) => colorMetrics[icon.path]);

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
    sourceMode: els.sourceMode.value,
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

function readCustomIcons() {
  try {
    const icons = JSON.parse(localStorage.getItem(customAvatarKey) || "[]");
    if (icons.length && localStorage.getItem(customAvatarNameMigrationKey) !== "done") {
      const renamed = icons.map((icon, index) => ({
        ...icon,
        name: `avatar${index + 1}`,
        order: index + 1,
      }));
      localStorage.setItem(customAvatarKey, JSON.stringify(renamed));
      localStorage.setItem(customAvatarNameMigrationKey, "done");
      return renamed;
    }
    return icons;
  } catch {
    return [];
  }
}

function saveCustomIcons() {
  localStorage.setItem(customAvatarKey, JSON.stringify(customIcons));
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片：${file.name}`));
    };
    image.src = url;
  });
}

async function decodeAvatarImage(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to an image element for browsers or formats not supported by ImageBitmap.
    }
  }
  return loadImageElement(file);
}

function squareCrop(width, height, centerX, centerY, requestedSize) {
  const size = Math.min(Math.max(64, requestedSize), width, height);
  const x = Math.min(Math.max(0, centerX - size / 2), width - size);
  const y = Math.min(Math.max(0, centerY - size / 2), height - size);
  return { x, y, size };
}

function fallbackPortraitCrop(width, height) {
  const size = Math.min(width, height);
  const x = (width - size) / 2;
  const y = height > width ? (height - size) * 0.18 : (height - size) / 2;
  return { x, y, size };
}

async function detectPortraitCrop(source, width, height) {
  if (typeof window.FaceDetector === "function") {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 8 });
      const faces = await detector.detect(source);
      const face = faces
        .map((item) => item.boundingBox)
        .filter(Boolean)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (face) {
        const requestedSize = Math.max(face.width * 2.6, face.height * 2.8, Math.min(width, height) * 0.42);
        return squareCrop(
          width,
          height,
          face.x + face.width / 2,
          face.y + face.height * 0.85,
          requestedSize,
        );
      }
    } catch {
      // FaceDetector is optional; the deterministic upper-center crop below always works.
    }
  }
  return fallbackPortraitCrop(width, height);
}

async function cropAvatarFile(file) {
  const decoded = await decodeAvatarImage(file);
  try {
    const crop = await detectPortraitCrop(decoded.source, decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { alpha: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      decoded.source,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      outputSize,
      outputSize,
    );
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    decoded.release();
  }
}

function setCustomUploadBusy(isBusy, restingText = "上传头像") {
  els.customAvatarInput.disabled = isBusy;
  els.customAvatarPicker.classList.toggle("is-busy", isBusy);
  els.customAvatarPickerText.textContent = isBusy ? "自动裁剪中…" : restingText;
  renderIcons();
}

function saveColorMetrics() {
  localStorage.setItem(colorCacheKey, JSON.stringify(colorMetrics));
}

function allIcons() {
  return [...VOICEMOD_ICONS, ...DICEBEER_SOURCE_ICONS, ...AIFACE_SOURCE_ICONS, ...DEFAULT_CUSTOM_ICONS, ...customIcons];
}

function activeSourceIcons() {
  const source = els.sourceMode.value || "voicemod";
  if (source === "dicebeer") return DICEBEER_SOURCE_ICONS;
  if (source === "aiface") return AIFACE_SOURCE_ICONS;
  if (source === "custom") return [...DEFAULT_CUSTOM_ICONS, ...customIcons];
  return VOICEMOD_ICONS;
}

function updateSourceControls() {
  els.customAvatarPicker.hidden = true;
  els.libraryTools.classList.remove("show-custom-upload");
}

function updateSortOptions() {
  const source = els.sourceMode.value || "voicemod";
  updateSourceControls();
  const previous = els.sortMode.value;
  if (source === "voicemod") {
    els.sortMode.innerHTML = `
      <option value="default">默认排序</option>
      <option value="color">颜色渐变</option>
    `;
    els.sortMode.value = previous === "color" ? "color" : "default";
  } else if (source === "dicebeer") {
    els.sortMode.innerHTML = `
      <option value="style">类别排序</option>
      <option value="default">默认排序</option>
    `;
    els.sortMode.value = previous === "default" ? "default" : "style";
  } else if (source === "aiface") {
    els.sortMode.innerHTML = `<option value="default">默认排序</option>`;
    els.sortMode.value = "default";
  } else {
    els.sortMode.innerHTML = `<option value="default">默认排序</option>`;
    els.sortMode.value = "default";
  }
}

function populateAvatarSelect(list = filteredIcons()) {
  els.avatarSelect.innerHTML = list
    .map((icon) => `<option value="${escapeHtml(icon.path)}">${escapeHtml(icon.name)}</option>`)
    .join("");
  if (list.some((icon) => icon.path === selectedIcon.path)) {
    els.avatarSelect.value = selectedIcon.path;
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

function isLightColor(value) {
  const match = String(value || "").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return false;
  const [, r, g, b] = match.map((part) => parseInt(part, 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55;
}

function applyBackground() {
  const isTransparent = els.bgMode.value === "transparent";
  const isImage = els.bgMode.value === "image" && backgroundImageUrl;
  const background = backgroundValue();
  els.stageCard.classList.toggle("transparent-preview", isTransparent);
  els.stageCard.classList.toggle("light-background", !isImage && isLightColor(background));

  if (isImage) {
    els.stageCard.style.backgroundColor = "#000000";
    els.stageCard.style.backgroundImage = `url("${backgroundImageUrl}")`;
    els.stageCard.style.backgroundPosition = "center";
    els.stageCard.style.backgroundRepeat = "no-repeat";
    els.stageCard.style.backgroundSize = "cover";
  } else {
    els.stageCard.style.background = background;
    els.stageCard.style.backgroundImage = "";
    els.stageCard.style.backgroundPosition = "";
    els.stageCard.style.backgroundRepeat = "";
    els.stageCard.style.backgroundSize = "";
  }
  saveState();
}

function updateControlValues() {
  const sensitivity = Number(els.sensitivity.value);
  const maxSensitivity = Number(els.sensitivity.max);
  const motion = Number(els.motion.value);
  const maxMotion = Number(els.motion.max);
  els.sensitivityValue.textContent = sensitivity >= maxSensitivity ? "max" : `${sensitivity.toFixed(1)}x`;
  els.motionValue.textContent = motion >= maxMotion ? "max" : `${motion.toFixed(1)}x`;
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

  colorSortPromise = Promise.all(VOICEMOD_ICONS.map(async (icon) => {
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
  if (els.sourceMode.value === "dicebeer" && els.sortMode.value === "style") {
    return [...list].sort((a, b) => {
      const sa = dicebeerStyleOrder.indexOf(a.style);
      const sb = dicebeerStyleOrder.indexOf(b.style);
      return sa - sb || a.order - b.order || a.name.localeCompare(b.name);
    });
  }
  if (els.sourceMode.value !== "voicemod" || els.sortMode.value !== "color") return list;
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
  return sortedIcons(activeSourceIcons().filter((icon) => {
    const haystack = `${icon.name} ${icon.style || ""} ${icon.source || ""}`;
    return !q || normalize(haystack).includes(q);
  }));
}

function shouldPaginateAiface() {
  return (els.sourceMode.value || "voicemod") === "aiface";
}

function resetAifacePagination() {
  aifaceVisibleCount = AIFACE_BATCH_SIZE;
}

function renderIcons() {
  const list = filteredIcons();
  const suffix = els.sourceMode.value === "voicemod" && els.sortMode.value === "color" && !colorSortReady ? " · 正在计算颜色" : "";
  const sourceLabel = els.sourceMode.value || "voicemod";
  const displayList = shouldPaginateAiface() ? list.slice(0, aifaceVisibleCount) : list;
  const shownCount = displayList.length;
  els.stats.textContent = shouldPaginateAiface()
    ? `${sourceLabel} · ${shownCount}/${list.length}个头像${suffix}`
    : `${sourceLabel} · ${list.length}个头像${suffix}`;
  if (els.loadMoreBtn) {
    const hasMore = shouldPaginateAiface() && shownCount < list.length;
    els.loadMoreBtn.hidden = !hasMore;
    els.loadMoreBtn.textContent = hasMore ? `加载更多（还剩 ${list.length - shownCount}）` : "加载更多";
  }
  populateAvatarSelect(list);
  const uploadTile = sourceLabel === "custom" ? `
    <div class="avatar-tile upload-tile">
      <button
        class="avatar-choice custom-upload-choice ${els.customAvatarInput.disabled ? "is-busy" : ""}"
        type="button"
        data-custom-upload
        title="上传并自动裁剪自定义头像"
        ${els.customAvatarInput.disabled ? "disabled" : ""}
      >
        <span class="upload-avatar-icon" aria-hidden="true">+</span>
        <span class="upload-avatar-label">${escapeHtml(els.customAvatarInput.disabled ? "自动裁剪中…" : els.customAvatarPickerText.textContent || "上传头像")}</span>
      </button>
    </div>
  ` : "";
  els.grid.innerHTML = uploadTile + displayList.map((icon) => `
    <div class="avatar-tile ${icon.source === "custom" ? "custom-tile" : ""} ${icon.style ? "has-style-label" : ""}">
      <button
        class="avatar-choice ${icon.path === selectedIcon.path ? "selected" : ""}"
        type="button"
        data-avatar="${escapeHtml(icon.path)}"
        title="${escapeHtml(icon.name)}"
      >
        <img src="${escapeHtml(icon.path)}" alt="${escapeHtml(icon.name)}" loading="lazy" />
        <span>${escapeHtml(icon.name)}</span>
        ${icon.style ? `<em>${escapeHtml(icon.style)}</em>` : ""}
      </button>
    </div>
  `).join("");
}

function setAvatar(icon) {
  selectedIcon = icon;
  els.avatar.src = icon.path;
  els.avatar.alt = icon.name;
  if ([...els.avatarSelect.options].some((option) => option.value === icon.path)) {
    els.avatarSelect.value = icon.path;
  }
  els.nowTitle.textContent = icon.name;
  saveState();
  renderIcons();
}

function commitCustomAvatarName(path, name) {
  const icon = customIcons.find((item) => item.path === path);
  if (!icon) return;

  const nextName = String(name || "").trim();
  if (!nextName || nextName === icon.name) return;

  icon.name = nextName.slice(0, 60);
  saveCustomIcons();
  if (selectedIcon.path === path) {
    selectedIcon = icon;
    els.avatar.alt = icon.name;
    els.nowTitle.textContent = icon.name;
    saveState();
  }
  renderIcons();
}

function ensureCustomRenameDialog() {
  let dialog = document.querySelector("#customAvatarRenameDialog");
  if (dialog) return dialog;

  dialog = document.createElement("div");
  dialog.id = "customAvatarRenameDialog";
  dialog.className = "custom-rename-modal";
  dialog.hidden = true;
  dialog.innerHTML = `
    <form class="custom-rename-box" role="dialog" aria-modal="true" aria-labelledby="customRenameTitle">
      <h3 id="customRenameTitle">重命名头像</h3>
      <input id="customRenameInput" type="text" maxlength="60" autocomplete="off" />
      <div class="custom-rename-actions">
        <button type="button" data-rename-cancel>取消</button>
        <button type="submit">确认</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-rename-cancel]")) closeCustomRenameDialog();
  });
  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = dialog.querySelector("#customRenameInput");
    commitCustomAvatarName(customRenamePath, input.value);
    closeCustomRenameDialog();
  });

  return dialog;
}

function openCustomRenameDialog(path) {
  const icon = customIcons.find((item) => item.path === path);
  if (!icon) return;

  const dialog = ensureCustomRenameDialog();
  const input = dialog.querySelector("#customRenameInput");
  customRenamePath = path;
  input.value = icon.name;
  dialog.hidden = false;
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function closeCustomRenameDialog() {
  const dialog = document.querySelector("#customAvatarRenameDialog");
  if (dialog) dialog.hidden = true;
  customRenamePath = "";
}

function renameCustomAvatar(path) {
  openCustomRenameDialog(path);
}

function deleteCustomAvatar(path) {
  const icon = customIcons.find((item) => item.path === path);
  if (!icon) return;
  if (!window.confirm(`删除自定义头像“${icon.name}”？`)) return;

  customIcons = customIcons.filter((item) => item.path !== path);
  saveCustomIcons();

  if (selectedIcon.path === path) {
    const replacement = activeSourceIcons()[0] || VOICEMOD_ICONS[0];
    setAvatar(replacement);
    return;
  }

  renderIcons();
}

function ensureCustomContextMenu() {
  let menu = document.querySelector("#customAvatarContextMenu");
  if (menu) return menu;

  menu = document.createElement("div");
  menu.id = "customAvatarContextMenu";
  menu.className = "custom-avatar-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" data-custom-menu-action="rename" role="menuitem">重命名</button>
    <button type="button" data-custom-menu-action="delete" role="menuitem">删除</button>
  `;
  document.body.appendChild(menu);
  return menu;
}

function hideCustomContextMenu() {
  const menu = document.querySelector("#customAvatarContextMenu");
  if (menu) menu.hidden = true;
  customContextPath = "";
}

function showCustomContextMenu(event, path) {
  const menu = ensureCustomContextMenu();
  customContextPath = path;
  menu.hidden = false;

  const menuWidth = menu.offsetWidth || 112;
  const menuHeight = menu.offsetHeight || 78;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
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

  els.sourceMode.value = "voicemod";
  updateSortOptions();
  els.bgMode.value = "black";
  if (saved.customBg) els.customBg.value = saved.customBg;
  if (saved.sortMode && [...els.sortMode.options].some((option) => option.value === saved.sortMode)) {
    els.sortMode.value = saved.sortMode;
  }
  if (saved.sensitivity && saved.sensitivity !== "1.8") els.sensitivity.value = saved.sensitivity;
  if (saved.motion) els.motion.value = saved.motion;
  updateControlValues();
  setDriveMode("stage1");

  setAvatar(VOICEMOD_ICONS.find((icon) => icon.name === "Clean Mic") || VOICEMOD_ICONS[0]);
  setEnergy(0);

  if (els.sourceMode.value === "voicemod" && els.sortMode.value === "color") {
    ensureColorSort().then(renderIcons);
  }

  els.search.addEventListener("input", () => {
    resetAifacePagination();
    renderIcons();
  });
  els.sourceMode.addEventListener("change", () => {
    resetAifacePagination();
    updateSortOptions();
    saveState();
    const list = filteredIcons();
    renderIcons();
    if (list.length) setAvatar(list[0]);
  });
  els.sortMode.addEventListener("change", async () => {
    resetAifacePagination();
    saveState();
    renderIcons();
    if (els.sourceMode.value === "voicemod" && els.sortMode.value === "color") {
      await ensureColorSort();
      renderIcons();
    }
  });
  els.avatarSelect.addEventListener("change", () => {
    const icon = allIcons().find((item) => item.path === els.avatarSelect.value) || activeSourceIcons()[0] || VOICEMOD_ICONS[0];
    setAvatar(icon);
  });
  els.loadMoreBtn?.addEventListener("click", () => {
    aifaceVisibleCount += AIFACE_BATCH_SIZE;
    renderIcons();
  });
  els.grid.addEventListener("click", (event) => {
    hideCustomContextMenu();
    const uploadButton = event.target.closest("[data-custom-upload]");
    if (uploadButton) {
      if (!els.customAvatarInput.disabled) els.customAvatarInput.click();
      return;
    }
    const button = event.target.closest("[data-avatar]");
    if (!button) return;
    const icon = allIcons().find((item) => item.path === button.dataset.avatar) || activeSourceIcons()[0] || VOICEMOD_ICONS[0];
    setAvatar(icon);
  });
  els.grid.addEventListener("contextmenu", (event) => {
    const button = event.target.closest("[data-avatar]");
    if (!button) return;
    const icon = customIcons.find((item) => item.path === button.dataset.avatar);
    if (!icon) return;
    event.preventDefault();
    showCustomContextMenu(event, icon.path);
  });
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-custom-menu-action]");
    if (!actionButton) {
      hideCustomContextMenu();
      return;
    }

    const path = customContextPath;
    hideCustomContextMenu();
    if (actionButton.dataset.customMenuAction === "rename") renameCustomAvatar(path);
    if (actionButton.dataset.customMenuAction === "delete") deleteCustomAvatar(path);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCustomContextMenu();
      closeCustomRenameDialog();
    }
  });
  els.customAvatarInput.addEventListener("change", async () => {
    const files = [...(els.customAvatarInput.files || [])].filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    setCustomUploadBusy(true);
    let restingText = "上传头像";
    try {
      const timestamp = Date.now();
      const firstOrder = DEFAULT_CUSTOM_ICONS.length + customIcons.length + 1;
      const added = await Promise.all(files.map(async (file, index) => ({
        id: `custom_${timestamp}_${index}`,
        name: `avatar${firstOrder + index}`,
        path: await cropAvatarFile(file),
        source: "custom",
        order: firstOrder + index,
      })));
      const previousIcons = customIcons;
      customIcons = [...customIcons, ...added];
      try {
        saveCustomIcons();
      } catch (error) {
        customIcons = previousIcons;
        throw error;
      }
      els.sourceMode.value = "custom";
      updateSortOptions();
      renderIcons();
      setAvatar(added[0]);
    } catch (error) {
      console.error("Custom avatar crop failed", error);
      restingText = "裁剪失败，请重试";
    } finally {
      els.customAvatarInput.value = "";
      setCustomUploadBusy(false, restingText);
      if (restingText !== "上传头像") {
        window.setTimeout(() => {
          if (!els.customAvatarInput.disabled) els.customAvatarPickerText.textContent = "上传头像";
        }, 2200);
      }
    }
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
  els.scrollResourcesBtn?.addEventListener("click", () => {
    els.resourceSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.scrollTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
