async function load(url) {
  const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
  const response = await fetch(proxyUrl, {
    headers: {
      "x-requested-with": "XMLHttpRequest"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load from cors-anywhere: ${response.statusText}`);
  }
  return response.blob();
}
export {
  load as default
};
