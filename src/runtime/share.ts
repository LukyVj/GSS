// A scene in a link: the code is compressed, then written in the URL after "#code=".
// Nothing is sent to a server: the fragment after "#" never leaves the browser.

const PREFIX = "#code=";

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

// GSS code → "#code=…"
export async function encodeCode(code: string): Promise<string> {
  return PREFIX + toBase64Url(await compress(code));
}

// "#code=…" → GSS code, or null if the hash holds no code (or a broken one)
export async function decodeCode(hash: string): Promise<string | null> {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    return await decompress(fromBase64Url(hash.slice(PREFIX.length)));
  } catch {
    return null;
  }
}
