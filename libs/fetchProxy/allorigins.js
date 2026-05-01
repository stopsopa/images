async function load(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to load from allorigins: ${response.statusText}`);
  }
  const json = await response.json();
  if (!json.contents) {
    throw new Error("AllOrigins returned empty contents.");
  }
  // AllOrigins automatically converts binary image data into a Base64 Data URI
  // Format: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  const match = json.contents.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("AllOrigins did not return a valid Base64 image payload.");
  }
  const mime = match[1];
  const b64Data = match[2];
  // Decode Base64 safely to Uint8Array
  const byteCharacters = atob(b64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mime });
}
export {
  load as default
};
