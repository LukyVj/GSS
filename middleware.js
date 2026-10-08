// Vercel Routing Middleware: staging.gss-lang.dev asks for a password before anything is
// served; every other host passes through untouched. The password is the STAGING_PASSWORD
// environment variable of the Vercel project, never in the code. Any user name is accepted.
const STAGING_HOST = "staging.gss-lang.dev";

export default function middleware(request) {
  if ((request.headers.get("host") ?? "") !== STAGING_HOST) return;

  const password = process.env.STAGING_PASSWORD;
  // Without a password set, stay closed rather than open
  if (!password) return new Response("Staging is not configured.", { status: 503 });

  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      // Not base64: refused below
    }
    // user:password, the password may itself contain colons
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (decoded.includes(":") && sameText(given, password)) return;
  }
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GSS staging", charset="UTF-8"' },
  });
}

// Compares in a time that does not depend on where the texts differ
function sameText(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
