# AI Implementation Plan: Single-File Browser Image Processor (index.html)

## Goal
Build a fully static single-page app (`index.html`) that:
- Loads images from clipboard, file upload, or URL
- Allows interactive cropping
- Supports resizing (aspect-ratio aware)
- Converts image to WebP
- Lets user download processed image
- Runs entirely in browser (no backend)

---

## 1. Tech Stack (Mandatory Constraints)
- Vanilla JavaScript (ES6+)
- HTML5 + CSS (minimal styling)
- Canvas API (core image processing engine)
- Optional lightweight library:
  - Cropper.js (recommended for cropping UI)

No backend, no Node.js, no build tools.

---

## 2. Core Functional Blocks

### 2.1 Image Input Layer
Implement 3 input methods:

#### A. File Upload
- `<input type="file" accept="image/*">`
- Read using `FileReader` or `createImageBitmap`

#### B. Clipboard Paste
- Listen for `paste` event
- Extract image from `event.clipboardData.files`
- Fallback: clipboard API if needed

#### C. Image URL
- Input field for URL
- Fetch image as `blob`
- Convert to object URL
- Handle CORS failure gracefully

---

### 2.2 Image Rendering Layer
- Render loaded image into `<canvas>`
- Maintain:
  - original dimensions
  - displayed preview scale
- Store image state object:
```js
{
  image: ImageBitmap,
  width,
  height,
  rotation,
  cropRegion
}

