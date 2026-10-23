import { escapeHtml } from "../docs/escape";

// The people whose work is in GSS, in the order of their first pull request. Each contribution
// is a short line (`code` between backquotes) and the number of its pull request on GitHub.
// A merged pull request from someone new adds them here.
export type Contributor = { name: string; login: string; work: [line: string, pull: number][] };

export const CONTRIBUTORS: Contributor[] = [
  {
    name: "Michael Silva",
    login: "michaelsilva",
    work: [
      ["Every scene of the showcase tested on WebGL2", 4],
      ["The `<gss-scene>` snippets of the VS Code extension", 6],
      ["Smoother silhouettes with `shape-rendering: geometricPrecision`", 7],
    ],
  },
  {
    name: "Yoshihiro Hasegawa",
    login: "hiroghap1",
    work: [["`texture-mapping: sphere`, an image around a globe", 15]],
  },
];

const PULLS = "https://github.com/LukyVj/GSS/pull/";

// A line with its `code` written as code
const inline = (line: string) =>
  escapeHtml(line).replace(/`([^`]+)`/g, (_match, code: string) => `<code>${code}</code>`);

// The items of the list of the home page: an avatar, a name, a list of pull requests
export function renderContributors(contributors: Contributor[] = CONTRIBUTORS): string {
  return contributors
    .map(
      ({ name, login, work }) => `<li class="contributor">
            <img src="https://github.com/${login}.png?size=96" alt="" width="48" height="48" loading="lazy" />
            <div>
              <a href="https://github.com/${login}">${escapeHtml(name)}</a>
              <ul>${work.map(([line, pull]) => `<li><a href="${PULLS}${pull}">${inline(line)}</a> <span>#${pull}</span></li>`).join("")}</ul>
            </div>
          </li>`,
    )
    .join("\n          ");
}
