export default async function load(url: string): Promise<Blob> {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to load from corsproxy.io: ${response.statusText}`);
    }
    return response.blob();
}
