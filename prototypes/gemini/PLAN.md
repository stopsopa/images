# Single-File Image Processor: Implementation Plan

This plan outlines the architecture for a client-side application that processes images entirely within the browser.

## 1. Technical Requirements
* **Environment:** Static `index.html` (HTML, CSS, JS).
* **Core APIs:** * `Clipboard API`: To read images from the clipboard.
    * `Canvas API`: For image manipulation (cropping/resizing).
    * `Blob/Object URL`: For file handling and download generation.
* **Optional Library:** `cropperjs` (via CDN) for interactive cropping UI.

## 2. Functional Architecture

### A. Input Handling
* **Paste:** Attach `window.addEventListener('paste')`. Iterate through `event.clipboardData.items` to identify `image/` blobs.
* **Upload:** Standard `<input type="file">`.
* **Processing:** Use `URL.createObjectURL(file)` to load blobs into an `<img>` tag for display.

### B. Manipulation Logic
* **Cropping:** Extract `x, y, width, height` from the UI layer. Use `context.drawImage()` with source and destination parameters to draw the cropped region onto a new canvas.
* **Resizing:** * Maintain ratio: Calculate new dimensions based on width/height constraints.
    * Absolute: Set `canvas.width` and `canvas.height` to the target pixels.
    * Redraw the cropped area into the scaled canvas.

### C. Export & Download
* **Format:** Use `canvas.toBlob(callback, 'image/webp', quality)`.
* **Download:**
    ```javascript
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'processed-image.webp';
    link.click();
    ```

## 3. Implementation Steps

1. **Scaffold:** Create a centered UI with an upload/paste zone and a hidden canvas.
2. **Initialize:** Add event listeners for `paste` and `change` (input).
3. **Display:** When an image is detected, render it into an `<img>` element for interactive cropping.
4. **Transform:** On "Download" click:
    * Capture crop data from the UI.
    * Perform `drawImage()` onto an off-screen canvas.
    * Trigger `toBlob` conversion to `image/webp`.
5. **Finalize:** Revoke object URLs to free memory.

## 4. Important Considerations
* **CORS:** Images fetched from external URLs must have CORS headers enabled to allow canvas manipulation ("tainted" canvas error).
* **Memory:** Large images (e.g., 20MP+) require careful memory management; clear canvas and object URLs immediately after processing.
* **Performance:** Browser-side processing is local; no server communication is required.