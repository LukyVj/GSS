// After a share, the status bar offers to post the scene on X: the composer opens with
// a line that mentions the GSS account and the share link. The reader writes the rest.

const POST_TEXT = "Made with @GSS_lang, CSS for 3D scenes";

export function postOnXUrl(shareUrl: string): string {
  const url = new URL("https://x.com/intent/post");
  url.searchParams.set("text", POST_TEXT);
  url.searchParams.set("url", shareUrl);
  return url.toString();
}
