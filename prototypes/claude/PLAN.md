# Image Crop + Resize + WebP Export - Single HTML File
## Implementation Plan

---

## Overview

Single `index.html`. No server. No dependencies (optional: Cropper.js).
Pipeline: **Input -> Preview -> Crop -> Resize -> Export WebP**

---

## 1. File Structure

```
index.html
  <head>   - styles (CSS variables, layout)
  <body>   - UI sections (steps 1-4)
  <script> - all logic inline
```

No build step. No npm. Open directly in browser.

---

## 2. Input Stage

**Two input methods:**

### 2a. Paste from clipboard
```js
document.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) loadBlob(item.getAsFile());
});
```

### 2b. Load by URL
```js
async function loadFromUrl(url) {
  // Use fetch + blob URL to avoid tainting canvas with CORS issues
  const blob = await fetch(url).then(r => r.blob());
  loadBlob(blob);
}
```
- Show URL input field + "Load" button
- On fail (CORS), show clear error: "Image blocked by CORS - try downloading it first"

### 2c. Also support: drag-and-drop + file input (click to browse) - easy wins

### Common handler
```js
function loadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => initCrop(img);
  img.src = url;
}
```

---

## 3. Crop Stage

**No library approach (preferred for single-file):**

- Render image in a container div
- Overlay a semi-transparent dark mask div (covers whole image)
- Render a crop-box div on top with:
  - `outline: 9999px solid rgba(0,0,0,0.5)` trick OR use 4 mask divs
  - 8 resize handles (corners + edges) as small draggable divs
  - Drag body of crop-box to move it
  - Drag handles to resize it

**State to track:**
```js
const crop = { x: 0, y: 0, w: 0, h: 0 }; // in image pixels, not screen px
```

Scale between display size and actual image pixels:
```js
const scaleX = img.naturalWidth / displayWidth;
const scaleY = img.naturalHeight / displayHeight;
```

**Mouse events:**
- `mousedown` on handle -> set active handle
- `mousemove` on document -> update crop rect
- `mouseup` on document -> release
- Mirror with `touchstart/touchmove/touchend` for mobile

**Show live readout:** "Crop: 800 x 600 px" updating on every move.

**Constraints:**
- Clamp crop rect to image bounds
- Minimum crop size (e.g. 10x10)

**Optional shortcut:** If adding Cropper.js is acceptable, replace this entire section with:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
```
```js
const cropper = new Cropper(imgEl, { viewMode: 1 });
const cropData = cropper.getData(true); // rounded pixel values
```
Decision: go with custom if truly zero-dependency is required, Cropper.js if polish matters more.

---

## 4. Resize Stage

Show after crop is confirmed.

**UI controls:**
- Toggle: "Keep aspect ratio" (checkbox, default ON)
- Input: Width (px)
- Input: Height (px)
- Preset buttons: "Original", "1920", "1280", "800", "50%"

**Logic:**
```js
let lockRatio = true;
const cropRatio = crop.w / crop.h;

widthInput.addEventListener('input', () => {
  if (lockRatio) heightInput.value = Math.round(widthInput.value / cropRatio);
});
heightInput.addEventListener('input', () => {
  if (lockRatio) widthInput.value = Math.round(heightInput.value * cropRatio);
});
```

**Also expose:**
- WebP quality slider: 0-100 (maps to 0.0-1.0 for `toBlob`)
- Default: 85

---

## 5. Processing + Export Stage

Triggered by "Export WebP" button.

```js
async function exportWebP() {
  const canvas = document.createElement('canvas');
  canvas.width  = parseInt(widthInput.value);
  canvas.height = parseInt(heightInput.value);
  const ctx = canvas.getContext('2d');

  // drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.drawImage(
    sourceImg,
    crop.x, crop.y, crop.w, crop.h,   // source rect (cropped area)
    0, 0, canvas.width, canvas.height  // destination (resized)
  );

  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'image.webp';
    a.click();
  }, 'image/webp', quality / 100);
}
```

Show file size estimate before download (from blob.size).

---

## 6. UI Flow (Steps)

```
[Step 1: Input]   paste / URL / drag / browse
      |
[Step 2: Crop]    interactive crop box over image
      v
[Step 3: Resize]  width/height inputs + ratio lock + quality
      v
[Step 4: Export]  preview thumbnail + file size + download button
```

Each step reveals on completion of previous. "Back" button on each step.

---

## 7. Edge Cases to Handle

| Case | Handling |
|---|---|
| CORS block on URL | Catch fetch error, show message |
| Non-image clipboard content | Check MIME type before loading |
| Canvas tainted by cross-origin img | Always go through fetch->blob->objectURL |
| Very large image (>20MP) | Warn user, offer to pre-scale before cropping |
| WebP not supported (old browser) | `canvas.toDataURL('image/webp')` starts with `data:image/png` if unsupported - detect and warn |
| User skips crop | Default crop = full image |
| User skips resize | Default = cropped image natural size |

---

## 8. Visual Design Direction

- Dark theme, utilitarian, precise
- Monospace font for px readout values
- Crop handles: 8px solid squares, high contrast
- Step indicator at top (1-2-3-4)
- No external CSS framework needed

---

## 9. What NOT to implement

- No server calls
- No WebAssembly / ffmpeg.wasm (overkill)
- No React/Vue (plain JS is sufficient)
- No image format inputs beyond what the browser decodes natively (JPEG, PNG, GIF, WebP, AVIF, SVG)
- No RAW / TIFF / HEIC support (browser cannot decode these natively)

---

## 10. Delivery

Single `index.html` file, opens directly with `File -> Open` in Chrome.
All JS and CSS inline. Zero network requests at runtime (except user-initiated URL fetch).

# Important

keep layout simple, on the left allow me to specify link to the image or upload image from clipboard, render image and allow me to define how to crop it and resize and on the right show how the final image will look like, once i am happy with it i can click a button to download the final image.

