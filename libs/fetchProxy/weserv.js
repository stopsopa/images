async function load(url) {
  const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to load from weserv: ${response.statusText}`);
  }
  return response.blob();
}
export {
  load as default
};
