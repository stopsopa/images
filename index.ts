/** @es.ts
{
    mode: "bundle",
    extension: ".js",
    outfile: "index.js"
}
@es.ts */

import drag, { getStyle } from "./libs/drag.js";
import loadWeserv from "./libs/fetchProxy/weserv.js";
import loadCodetabs from "./libs/fetchProxy/codetabs.js";

// State
let cropper: any = null;
let sourceImg: HTMLImageElement | null = null;
let currentBlob: Blob | null = null;
let isProcessing = false;
let isInternalUpdate = false;
let isManualDownloadSize = false;
let isUpdatingDownloadInputs = false;
let currentDownloadScale = 1;

let activeAction: string | null = null;
let startRatio = 1;
let startBox: any = null;

let originalBaseName = "image";
let filenameUserTouched = false;
let currentNameWidth = 1200;
let currentNameHeight = 800;
let currentNameQuality = 85;
let existingPaths: string[] = [];

// Elements
const el = {
  inputStage: document.getElementById("input-stage") as HTMLElement,
  cropStage: document.getElementById("crop-stage") as HTMLElement,
  dropZone: document.getElementById("drop-zone") as HTMLElement,
  fileInput: document.getElementById("file-input") as HTMLInputElement,
  urlInput: document.getElementById("url-input") as HTMLInputElement,
  urlLoadBtn: document.getElementById("url-load-btn") as HTMLButtonElement,
  imgToCrop: document.getElementById("image-to-crop") as HTMLImageElement,
  previewImg: document.getElementById("preview-img") as HTMLImageElement,
  previewPlaceholder: document.getElementById("preview-placeholder") as HTMLElement,

  cropWidth: document.getElementById("crop-width") as HTMLInputElement,
  cropHeight: document.getElementById("crop-height") as HTMLInputElement,

  downloadWidth: document.getElementById("download-width") as HTMLInputElement,
  downloadHeight: document.getElementById("download-height") as HTMLInputElement,
  downloadQuality: document.getElementById("download-quality") as HTMLInputElement,
  downloadLock: document.getElementById("download-lock") as HTMLInputElement,
  filenameInput: document.getElementById("filename-input") as HTMLInputElement,

  padTop: document.getElementById("pad-top") as HTMLInputElement,
  padRight: document.getElementById("pad-right") as HTMLInputElement,
  padBottom: document.getElementById("pad-bottom") as HTMLInputElement,
  padLeft: document.getElementById("pad-left") as HTMLInputElement,
  restrictCrop: document.getElementById("restrict-crop") as HTMLInputElement,

  exportBtn: document.getElementById("export-btn") as HTMLButtonElement,
  toast: document.getElementById("toast") as HTMLElement,
  floatPreviewBtn: document.getElementById("float-preview-btn") as HTMLButtonElement,
  stats: {
    source: document.getElementById("stat-source-size") as HTMLElement,
    crop: document.getElementById("stat-crop-area") as HTMLElement,
    file: document.getElementById("stat-file-size") as HTMLElement,
  },
  bgRadios: document.querySelectorAll('input[name="bg-type"]') as NodeListOf<HTMLInputElement>,
  cropperWrapper: document.querySelector(".cropper-container-wrapper") as HTMLElement,
};

// --- Initialization ---

function init() {
  el.dropZone.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", (e: any) => {
    if (e.target.files.length) loadBlob(e.target.files[0]);
  });

  el.urlLoadBtn.addEventListener("click", () => {
    const url = el.urlInput.value.trim();
    if (url) loadFromUrl(url);
  });

  // Background Selector logic
  el.bgRadios.forEach((radio) => {
    radio.addEventListener("change", (e: any) => {
      el.cropperWrapper.classList.remove("bg-bright", "bg-dark", "bg-grid");
      el.cropperWrapper.classList.add(e.target.value);
    });
  });

  document.addEventListener("paste", (e: any) => {
    const item = [...e.clipboardData.items].find((i) =>
      i.type.startsWith("image/"),
    );
    if (item) loadBlob(item.getAsFile());
  });

  ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
    el.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  el.dropZone.addEventListener("dragover", () =>
    el.dropZone.classList.add("dragover"),
  );
  el.dropZone.addEventListener("dragleave", () =>
    el.dropZone.classList.remove("dragover"),
  );
  el.dropZone.addEventListener("drop", (e: any) => {
    el.dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadBlob(file);
  });

  // Crop Inputs (Left)
  el.cropWidth.addEventListener("input", () => syncCropFromInputs());
  el.cropHeight.addEventListener("input", () => syncCropFromInputs());

  [el.padTop, el.padRight, el.padBottom, el.padLeft].forEach((input) => {
    input.addEventListener("input", syncDownloadInputsFromCropOrPad);
  });

  el.restrictCrop.addEventListener("change", () => {
    if (cropper) {
      const data = cropper.getData();
      const url = el.imgToCrop.src;
      setupCropper(url);
      // Try to restore crop data after re-init if possible, 
      // though viewMode change might constrain it.
      setTimeout(() => cropper.setData(data), 0);
    }
  });

  // Download Inputs (Right)
  el.downloadWidth.addEventListener("input", onDownloadWidthChange);
  el.downloadHeight.addEventListener("input", onDownloadHeightChange);
  el.downloadLock.addEventListener("change", () => {
    if (el.downloadLock.checked) onDownloadWidthChange();
  });
  el.downloadQuality.addEventListener("input", updatePreviewDebounced);

  el.filenameInput.addEventListener("input", () => {
    filenameUserTouched = true;
    // Reset button state if it was in confirmation mode
    if (el.exportBtn.textContent === "Download anyway?") {
      el.exportBtn.textContent = "Download Image";
      el.exportBtn.style.background = "";
    }
  });

  el.filenameInput.addEventListener("focus", () => {
    if (!filenameUserTouched) {
      // Use setTimeout to ensure selection happens after browser default focus behavior
      setTimeout(() => {
        el.filenameInput.setSelectionRange(0, originalBaseName.length);
      }, 0);
    }
  });

  const formatRadios = document.querySelectorAll(
    'input[name="export-format"]',
  ) as NodeListOf<HTMLInputElement>;
  formatRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updatePreviewDebounced();
      checkExistingFilename();
    });
  });

  // Check existing filename on input
  el.filenameInput.addEventListener("input", checkExistingFilename);

  el.exportBtn.addEventListener("click", exportImage);

  // Float Preview logic
  let isPreviewFloating = false;
  let unbindDrag: any = null;

  el.floatPreviewBtn.addEventListener("click", () => {
    const previewBox = document.querySelector(".preview-box") as HTMLElement;
    isPreviewFloating = !isPreviewFloating;

    if (isPreviewFloating) {
      el.floatPreviewBtn.textContent = "Unfloat";

      const rect = previewBox.getBoundingClientRect();

      // Create placeholder to prevent layout collapse
      const placeholder = document.createElement("div");
      placeholder.id = "preview-box-placeholder";
      placeholder.style.width = "100%";
      placeholder.style.aspectRatio = "1/1";
      (previewBox.parentNode as HTMLElement).insertBefore(placeholder, previewBox);

      // Move to body to escape backdrop-filter containing block
      document.body.appendChild(previewBox);

      previewBox.style.position = "fixed";
      previewBox.style.zIndex = "1000";

      // Position at top 10px, right 10px
      const topPos = 10;
      const leftPos = window.innerWidth - rect.width - 10;

      previewBox.style.left = `${leftPos}px`;
      previewBox.style.top = `${topPos}px`;
      previewBox.style.width = `${rect.width}px`;
      previewBox.style.height = `${rect.height}px`;
      previewBox.style.boxShadow = "0 20px 40px rgba(0,0,0,0.8)";
      previewBox.style.cursor = "move";

      if (!unbindDrag) {
        unbindDrag = drag(
          previewBox,
          (x, y) => {
            previewBox.style.left = `${x}px`;
            previewBox.style.top = `${y}px`;
          },
          () => {
            const s = getStyle(previewBox);
            return {
              x: parseInt(s.left as string, 10) || 0,
              y: parseInt(s.top as string, 10) || 0,
            };
          },
        );
      }
    } else {
      el.floatPreviewBtn.textContent = "Float";

      if (unbindDrag) {
        unbindDrag();
        unbindDrag = null;
      }

      const placeholder = document.getElementById(
        "preview-box-placeholder",
      );
      if (placeholder) {
        (placeholder.parentNode as HTMLElement).insertBefore(previewBox, placeholder);
        placeholder.remove();
      }

      previewBox.style.position = "";
      previewBox.style.zIndex = "";
      previewBox.style.left = "";
      previewBox.style.top = "";
      previewBox.style.width = "100%";
      previewBox.style.height = "";
      previewBox.style.boxShadow = "";
      previewBox.style.cursor = "";
    }
  });

  setupScrubbableInputs();
  loadExistingPaths();
  // Refresh existing paths every 30 seconds
  setInterval(loadExistingPaths, 30000);
}

// --- Filename existence check ---

async function loadExistingPaths() {
  try {
    const resp = await fetch(`process.json?v=${Date.now()}`);
    if (resp.ok) {
      const text = await resp.text();
      existingPaths = text
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          try {
            return JSON.parse(l)[0];
          } catch (e) {
            return null;
          }
        })
        .filter((p) => p !== null);
      console.log(`Loaded ${existingPaths.length} existing paths from process.json`);
      checkExistingFilename();
    } else {
      console.error(`Failed to load process.json: ${resp.status} ${resp.statusText}`);
    }
  } catch (e) {
    console.error("Failed to load process.json", e);
  }
}

function checkExistingFilename() {
  const name = el.filenameInput.value.trim();
  console.log(`Checking filename: "${name}"`);
  if (!name) {
    el.filenameInput.style.color = "";
    return;
  }

  // Check if any existing path (stripped of extension and path) matches this name
  const exists = existingPaths.some((p) => {
    const filename = p.split("/").pop() || "";
    const base = filename.replace(/\.[^/.]+$/, "");
    const match = base === name;
    if (match) console.log(`Match found: "${p}" -> base: "${base}"`);
    return match;
  });

  if (exists) {
    console.log(`Filename "${name}" EXISTS in process.json. Setting color to RED.`);
    el.filenameInput.style.setProperty("color", "#ef4444", "important");
  } else {
    el.filenameInput.style.color = "";
  }
}

// --- Scrubbable Inputs ---
function setupScrubbableInputs() {
  const numberInputs = document.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;

  numberInputs.forEach((input) => {
    const label =
      (input.parentElement as HTMLElement).querySelector("label") ||
      input.closest(".control-item")?.querySelector("label");

    let isDragging = false;
    let startX = 0;
    let startValue = 0;

    const onMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startValue = parseFloat(input.value) || 0;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;

      if (!isDragging && Math.abs(dx) > 2) {
        isDragging = true;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
      }

      if (isDragging) {
        e.preventDefault();
        const delta = Math.round(dx / 2); // 2 pixels = 1 unit change
        let newValue = startValue + delta;

        // Ensure no negative values unless explicitly allowed by min attribute (but user said "Don't allow negative values")
        const min = input.hasAttribute("min") ? Math.max(0, parseFloat(input.getAttribute("min") as string)) : 0;
        newValue = Math.max(min, newValue);

        if (input.hasAttribute("max"))
          newValue = Math.min(parseFloat(input.getAttribute("max") as string), newValue);

        if (parseFloat(input.value) != newValue) {
          input.value = String(newValue);
          input.dispatchEvent(new Event("input"));
        }
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    if (label) {
      (label as HTMLElement).style.cursor = "ew-resize";
      (label as HTMLElement).title = "Drag left/right to adjust value";
      label.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onMouseDown(e);
      });
    }

    input.title = "Drag left/right to adjust value";
    input.addEventListener("mousedown", (e) => {
      onMouseDown(e);
    });
    input.addEventListener("click", () => input.select());
  });
}

// --- Core Logic ---

async function loadFromUrl(url: string) {
  showToast("Loading image from URL...", 2000, "#3b82f6");
  try {
    // Use Promise.race to take the fastest successful response from our working proxies
    const blob = await Promise.race([loadWeserv(url), loadCodetabs(url)]);
    loadBlob(blob);
  } catch (err) {
    console.error("Load from URL failed:", err);
    showToast("CORS block or invalid URL. Try downloading first.", 4000);
  }
}

function loadBlob(blob: Blob) {
  currentBlob = blob;
  originalBaseName = (blob as any).name
    ? (blob as any).name.replace(/\.[^/.]+$/, "")
    : "image";
  filenameUserTouched = false;

  const url = URL.createObjectURL(blob);
  sourceImg = new Image();
  sourceImg.onload = () => {
    setupCropper(url);
    el.stats.source.textContent = `${sourceImg?.naturalWidth} x ${sourceImg?.naturalHeight} px`;

    // Auto-select prefix to encourage renaming
    setTimeout(() => {
      el.filenameInput.focus();
      const prefix = originalBaseName;
      el.filenameInput.setSelectionRange(0, prefix.length);
    }, 500);
  };
  sourceImg.src = url;

  el.inputStage.classList.add("hidden");
  el.cropStage.style.display = "flex";
  el.exportBtn.disabled = false;
}

function setupCropper(url: string) {
  if (cropper) cropper.destroy();
  isManualDownloadSize = false;
  currentDownloadScale = 1;

  el.imgToCrop.src = url;
  cropper = new (window as any).Cropper(el.imgToCrop, {
    viewMode: el.restrictCrop.checked ? 1 : 0,
    dragMode: "move",
    autoCropArea: 1,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    ready() {
      updatePreview();
    },
    cropstart(event: any) {
      activeAction = event.detail.action;
      const corners = ["nw", "ne", "sw", "se"];

      if (corners.includes(activeAction as string)) {
        startBox = cropper.getData();
        startRatio = startBox.width / startBox.height;
      } else {
        startBox = null;
      }
    },
    crop(event: any) {
      if (isInternalUpdate) return;

      const corners = ["nw", "ne", "sw", "se"];
      if (corners.includes(activeAction as string) && startBox) {
        isInternalUpdate = true;
        const data = event.detail;
        let w = data.width;
        let h = data.height;

        const dw = Math.abs(w - startBox.width) / startBox.width;
        const dh = Math.abs(h - startBox.height) / startBox.height;

        if (dw > dh) {
          h = w / startRatio;
        } else {
          w = h * startRatio;
        }

        const newData: any = { width: w, height: h };
        const right = startBox.x + startBox.width;
        const bottom = startBox.y + startBox.height;

        if (activeAction === "nw") {
          newData.x = right - w;
          newData.y = bottom - h;
        } else if (activeAction === "ne") {
          newData.x = startBox.x;
          newData.y = bottom - h;
        } else if (activeAction === "sw") {
          newData.x = right - w;
          newData.y = startBox.y;
        } else if (activeAction === "se") {
          newData.x = startBox.x;
          newData.y = startBox.y;
        }

        cropper.setData(newData);
        isInternalUpdate = false;

        el.cropWidth.value = String(Math.round(w));
        el.cropHeight.value = String(Math.round(h));
        syncDownloadInputsFromCropOrPad();
        el.stats.crop.textContent = `${Math.round(w)} x ${Math.round(h)} px`;
      } else {
        const data = event.detail;
        const w = Math.round(data.width);
        const h = Math.round(data.height);

        el.cropWidth.value = String(w);
        el.cropHeight.value = String(h);
        syncDownloadInputsFromCropOrPad();
        el.stats.crop.textContent = `${w} x ${h} px`;
      }
    },
  });
}

function syncCropFromInputs() {
  if (!cropper || isInternalUpdate) return;
  isInternalUpdate = true;

  const w = parseFloat(el.cropWidth.value) || 1;
  const h = parseFloat(el.cropHeight.value) || 1;

  const data = cropper.getData();
  cropper.setData({
    width: w,
    height: h,
    x: data.x,
    y: data.y,
  });

  isInternalUpdate = false;
  syncDownloadInputsFromCropOrPad();
}

function getPaddedDimensions() {
  const cw = parseFloat(el.cropWidth.value) || 1;
  const ch = parseFloat(el.cropHeight.value) || 1;
  const pt = parseFloat(el.padTop.value) || 0;
  const pr = parseFloat(el.padRight.value) || 0;
  const pb = parseFloat(el.padBottom.value) || 0;
  const pl = parseFloat(el.padLeft.value) || 0;
  return { w: Math.max(1, cw + pl + pr), h: Math.max(1, ch + pt + pb) };
}

function syncDownloadInputsFromCropOrPad() {
  if (isUpdatingDownloadInputs) return;
  const padded = getPaddedDimensions();

  if (!isManualDownloadSize) {
    el.downloadWidth.value = String(Math.round(padded.w));
    el.downloadHeight.value = String(Math.round(padded.h));
  } else if (el.downloadLock.checked) {
    isUpdatingDownloadInputs = true;
    el.downloadWidth.value = String(Math.max(1, Math.round(padded.w * currentDownloadScale)));
    el.downloadHeight.value = String(Math.max(1, Math.round(padded.h * currentDownloadScale)));
    isUpdatingDownloadInputs = false;
  }
  updatePreviewDebounced();
}

function onDownloadWidthChange() {
  isManualDownloadSize = true;
  if (isUpdatingDownloadInputs) return;
  const padded = getPaddedDimensions();
  currentDownloadScale = (parseFloat(el.downloadWidth.value) || 1) / padded.w;

  if (el.downloadLock.checked) {
    isUpdatingDownloadInputs = true;
    el.downloadHeight.value = String(Math.max(1, Math.round(padded.h * currentDownloadScale)));
    isUpdatingDownloadInputs = false;
  }
  updatePreviewDebounced();
}

function onDownloadHeightChange() {
  isManualDownloadSize = true;
  if (isUpdatingDownloadInputs) return;
  const padded = getPaddedDimensions();
  currentDownloadScale = (parseFloat(el.downloadHeight.value) || 1) / padded.h;

  if (el.downloadLock.checked) {
    isUpdatingDownloadInputs = true;
    el.downloadWidth.value = String(Math.max(1, Math.round(padded.w * currentDownloadScale)));
    isUpdatingDownloadInputs = false;
  }
  updatePreviewDebounced();
}

function createFinalCanvas(scaleToDownload = true) {
  if (!cropper) return null;

  const cw = Math.max(1, parseFloat(el.cropWidth.value) || 1);
  const ch = Math.max(1, parseFloat(el.cropHeight.value) || 1);

  const pt = Math.max(0, parseFloat(el.padTop.value) || 0);
  const pr = Math.max(0, parseFloat(el.padRight.value) || 0);
  const pb = Math.max(0, parseFloat(el.padBottom.value) || 0);
  const pl = Math.max(0, parseFloat(el.padLeft.value) || 0);

  const interW = cw + pl + pr;
  const interH = ch + pt + pb;

  const cropCanvas = cropper.getCroppedCanvas();
  if (!cropCanvas) return null;

  const interCanvas = document.createElement("canvas");
  interCanvas.width = interW;
  interCanvas.height = interH;
  const interCtx = interCanvas.getContext("2d");

  // Draw crop in the padded canvas (transparent background)
  interCtx?.drawImage(
    cropCanvas,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
    pl,
    pt,
    cw,
    ch,
  );

  if (!scaleToDownload) return interCanvas;

  const dw = Math.max(1, parseInt(el.downloadWidth.value) || 1);
  const dh = Math.max(1, parseInt(el.downloadHeight.value) || 1);

  if (interW === dw && interH === dh) {
    return interCanvas;
  }

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = dw;
  finalCanvas.height = dh;
  const finalCtx = finalCanvas.getContext("2d");
  if (finalCtx) {
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = "high";
  }

  let curCanvas = interCanvas;
  let curW = interW;
  let curH = interH;

  // Step-down scaling (halving steps) to prevent aliasing/jagged edges
  while (curW > dw * 2 && curH > dh * 2) {
    const nextW = Math.floor(curW / 2);
    const nextH = Math.floor(curH / 2);
    const nextCanvas = document.createElement("canvas");
    nextCanvas.width = nextW;
    nextCanvas.height = nextH;
    const nextCtx = nextCanvas.getContext("2d");
    if (nextCtx) {
      nextCtx.imageSmoothingEnabled = true;
      nextCtx.imageSmoothingQuality = "high";
      nextCtx.drawImage(curCanvas, 0, 0, nextW, nextH);
    }
    curCanvas = nextCanvas;
    curW = nextW;
    curH = nextH;
  }

  finalCtx?.drawImage(curCanvas, 0, 0, dw, dh);
  return finalCanvas;
}

let previewTimeout: any;
function updatePreviewDebounced() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(updatePreview, 100);
}

function syncFilenameInputs() {
  const newW = parseInt(el.downloadWidth.value) || 1;
  const newH = parseInt(el.downloadHeight.value) || 1;
  const newQ = parseInt(el.downloadQuality.value) || 85;

  if (!filenameUserTouched) {
    el.filenameInput.value = `${originalBaseName}_${newW}x${newH}q${newQ}`;
  } else {
    let val = el.filenameInput.value;

    if (newW !== currentNameWidth) {
      val = val.replace(/\d+x(?!.*\d+x)/, `${newW}x`);
    }
    if (newH !== currentNameHeight) {
      val = val.replace(/x\d+(?!.*x\d+)/, `x${newH}`);
    }
    if (newQ !== currentNameQuality) {
      val = val.replace(/q\d+(?!.*q\d+)/, `q${newQ}`);
    }

    el.filenameInput.value = val;
  }

  if (!filenameUserTouched) {
    el.filenameInput.classList.add("needs-attention");
  } else {
    el.filenameInput.classList.remove("needs-attention");
  }

  currentNameWidth = newW;
  currentNameHeight = newH;
  currentNameQuality = newQ;

  checkExistingFilename();
}

function updatePreview() {
  if (!cropper || isProcessing) return;

  isProcessing = true;
  syncFilenameInputs();

  const quality = parseInt(el.downloadQuality.value) || 85;
  const formatRadio = document.querySelector(
    'input[name="export-format"]:checked',
  ) as HTMLInputElement;
  const format = formatRadio ? formatRadio.value : "webp";
  const mimeType = `image/${format}`;
  const canvas = createFinalCanvas();

  if (!canvas) {
    isProcessing = false;
    return;
  }

  canvas.toBlob(
    (blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        el.previewImg.src = url;

        const parentRect = (el.previewImg.parentElement as HTMLElement).getBoundingClientRect();
        const parentRatio = parentRect.height > 0 ? (parentRect.width / parentRect.height) : 1;
        const imgRatio = canvas.height > 0 ? (canvas.width / canvas.height) : 1;

        if (imgRatio > parentRatio) {
          el.previewImg.style.width = "100%";
          el.previewImg.style.height = "auto";
        } else {
          el.previewImg.style.width = "auto";
          el.previewImg.style.height = "100%";
        }

        el.previewPlaceholder.classList.add("hidden");
        el.previewImg.classList.remove("hidden");
        el.stats.file.textContent = formatBytes(blob.size);
      }
      isProcessing = false;
    },
    mimeType,
    quality / 100,
  );
}

let exportConfirmTimeout: any = null;
async function exportImage() {
  if (!cropper) return;

  const name = el.filenameInput.value.trim();
  const exists = existingPaths.some((p) => {
    const filename = p.split("/").pop() || "";
    const base = filename.replace(/\.[^/.]+$/, "");
    return base === name;
  });

  if (exists) {
    if (el.exportBtn.textContent !== "Overwrite existing?") {
      el.exportBtn.textContent = "Overwrite existing?";
      el.exportBtn.style.background = "#ef4444";
      showToast("File already exists in gallery!", 3000, "#ef4444");
      return;
    }
  }

  if (!filenameUserTouched) {
    if (el.exportBtn.textContent !== "Download anyway?") {
      el.exportBtn.textContent = "Download anyway?";
      el.exportBtn.style.background = "#f59e0b"; // Warning orange
      el.filenameInput.focus();
      
      // Select the prefix segment
      const prefix = originalBaseName;
      el.filenameInput.setSelectionRange(0, prefix.length);
      
      clearTimeout(exportConfirmTimeout);
      exportConfirmTimeout = setTimeout(() => {
        el.exportBtn.textContent = "Download Image";
        el.exportBtn.style.background = "";
      }, 3000);
      
      showToast("You haven't set a filename yet!", 2000, "#f59e0b");
      return;
    }
  }

  const quality = parseInt(el.downloadQuality.value) || 85;
  const formatRadio = document.querySelector(
    'input[name="export-format"]:checked',
  ) as HTMLInputElement;
  const format = formatRadio ? formatRadio.value : "webp";
  const mimeType = `image/${format}`;
  const ext = format === "jpeg" ? "jpg" : format;

  const canvas = createFinalCanvas();
  if (!canvas) return;

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = el.filenameInput.value.trim() || "image";
      a.download = `${baseName}.${ext}`;
      a.click();
      showToast("Image exported!", 3000, "#10b981");

      // Reset button if it was in confirm state
      el.exportBtn.textContent = "Download Image";
      el.exportBtn.style.background = "";
      clearTimeout(exportConfirmTimeout);
    },
    mimeType,
    quality / 100,
  );
}

function showToast(msg: string, duration = 3000, color = "#ef4444") {
  el.toast.textContent = msg;
  el.toast.style.backgroundColor = color;
  el.toast.style.display = "block";
  setTimeout(() => (el.toast.style.display = "none"), duration);
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}

init();
