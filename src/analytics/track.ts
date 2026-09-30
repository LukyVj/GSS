// Every analytics event goes through here: if we change tools, only this file moves.

type EventName = "playground-share" | "playground-example" | "docs-try-it";

type EventData = Record<string, string | number>;

declare global {
  interface Window {
    // "?" : the script may be blocked, or not loaded yet
    umami?: { track(name: string, data?: EventData): void };
  }
}

export function track(name: EventName, data?: EventData): void {
  if (typeof window === "undefined" || !window.umami) return;
  window.umami.track(name, data);
}
