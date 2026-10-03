// A scene in a link: the code is compressed, then written in the URL after "#code=", and
// the HTML of element(#id) after "&html=" when there is some (decision 101).
// Nothing is sent to a server: the fragment after "#" never leaves the browser.

const PREFIX = "#code=";
const HTML = "&html=";

async function compress(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// Base64 that is safe in a URL: - and _ instead of + and /, and no "=" at the end
function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// GSS code (and its HTML) → "#code=…" (and "&html=…"); without HTML, the link of always
export async function encodeCode(code: string, html = ""): Promise<string> {
  const encoded = PREFIX + toBase64Url(await compress(code));
  return html ? encoded + HTML + toBase64Url(await compress(html)) : encoded;
}

// "#code=…" → GSS code, or null if the hash holds no code (or a broken one)
export async function decodeCode(hash: string): Promise<string | null> {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    return await decompress(fromBase64Url(hash.slice(PREFIX.length).split("&")[0]));
  } catch {
    return null;
  }
}

// "…&html=…" → the HTML of the scene, or "" when the link has none (or a broken one)
export async function decodeHtml(hash: string): Promise<string> {
  const at = hash.indexOf(HTML);
  if (!hash.startsWith(PREFIX) || at < 0) return "";
  try {
    return await decompress(fromBase64Url(hash.slice(at + HTML.length)));
  } catch {
    return "";
  }
}
