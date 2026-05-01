export default async function load(url: string): Promise<Blob> {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to load from codetabs.com: ${response.statusText}`);
    }
    return response.blob();
}
