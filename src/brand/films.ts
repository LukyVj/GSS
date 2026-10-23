import { escapeHtml } from "../docs/escape";

// The films of GSS, newest first. They live in the media bucket (Cloudflare R2), not in
// the repository: each one as `<file>.mp4` (16:9), `<file>-vertical.mp4` (9:16) and their
// posters `<file>.jpg` and `<file>-vertical.jpg`. scripts/upload-films.sh sends them there.
export const FILM_BASE = "https://media.gss-lang.dev/films/";

export type Film = { file: string; title: string; date: string; seconds: number; text: string };

export const FILMS: Film[] = [
  { file: "gss-0.0.7", title: "GSS 0.0.7", date: "2026-10-23", seconds: 68, text: "Text on every shape, loops, mixins, attribute selectors." },
  { file: "gss-0.0.6", title: "GSS 0.0.6", date: "2026-10-09", seconds: 60, text: "Outlines, cursors, @paint, new shapes." },
  { file: "gss-launch", title: "The launch", date: "2026-10-05", seconds: 47, text: "GSS, presented for its public release." },
  { file: "gss-teaser", title: "The teaser", date: "2026-10-02", seconds: 34.5, text: "The first announcement of GSS." },
];

// The tiles of the films: the 16:9 cut plays in place (nothing loads before play), the
// two cuts can be downloaded
export function renderFilms(films: Film[] = FILMS): string {
  return films
    .map(
      ({ file, title, date, seconds, text }) => `
          <figure class="tile film" style="margin: 0">
            <div class="art bleed">
              <video controls playsinline preload="none" poster="${FILM_BASE}${file}.jpg" aria-label="${escapeHtml(title)}">
                <source src="${FILM_BASE}${file}.mp4" type="video/mp4" />
              </video>
            </div>
            <footer>
              <span class="name">${escapeHtml(title)} · <time datetime="${date}">${date}</time> · ${Math.round(seconds)} s — ${escapeHtml(text)}</span>
              <a href="${FILM_BASE}${file}.mp4" download>16:9</a>
              <a href="${FILM_BASE}${file}-vertical.mp4" download>9:16</a>
            </footer>
          </figure>`,
    )
    .join("");
}
