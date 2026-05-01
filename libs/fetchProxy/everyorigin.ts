export default async function load(url: string): Promise<Blob> {
    const proxyUrl = `https://everyorigin.jwvbremen.nl/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to load from everyorigin: ${response.statusText}`);
    }
    
    const json = await response.json();
    if (!json.contents) {
        throw new Error('EveryOrigin returned empty contents.');
    }

    // Check if EveryOrigin converts binary image data into a Base64 Data URI like AllOrigins
    const match = json.contents.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
        throw new Error('EveryOrigin did not return a valid Base64 image payload. It may not support binary files like images.');
    }

    const mime = match[1];
    const b64Data = match[2];

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
