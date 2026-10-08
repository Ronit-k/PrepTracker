// Bundled marks avoid missing generic favicons for common prep sites.
const known = [
  ['leetcode.com','leetcode'], ['leetcode.cn','leetcode'],
  ['geeksforgeeks.org','gfg'], ['youtube.com','youtube'], ['youtu.be','youtube'],
];
export function faviconUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:','http:'].includes(url.protocol)) return '/static/icons/link.svg';
    const host = url.hostname.toLowerCase();
    const match = known.find(([domain])=>host===domain || host.endsWith('.'+domain));
    return match ? `/static/icons/${match[1]}.svg` : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch { return '/static/icons/link.svg'; }
}
export function iconMarkup(value) {
  return `<img src="${faviconUrl(value)}" width="18" height="18" class="site-favicon" alt="" onerror="this.onerror=null;this.src='/static/icons/link.svg'">`;
}
