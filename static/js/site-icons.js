// Resolve icons from the supplied website, with no bundled site-specific marks.
const fallback = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9696a3" stroke-width="1.7"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></svg>');
const attribute = value => value.replace(/[&"'<>]/g, char => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[char]));
export function faviconUrl(value) {
  try {
    const url = new URL(value);
    if (['https:','http:'].includes(url.protocol)) return `${url.origin}/favicon.ico`;
  } catch { /* Missing or invalid links use the neutral fallback. */ }
  return fallback;
}
export function iconMarkup(value) {
  const source = faviconUrl(value);
  const lookup = source === fallback ? fallback : `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(new URL(value).origin)}&sz=32`;
  return `<img src="${attribute(source)}" data-lookup="${attribute(lookup)}" data-fallback="${attribute(fallback)}" width="18" height="18" class="site-favicon" alt="" referrerpolicy="no-referrer" onerror="if(this.dataset.lookup){this.src=this.dataset.lookup;delete this.dataset.lookup}else{this.onerror=null;this.src=this.dataset.fallback}">`;
}
