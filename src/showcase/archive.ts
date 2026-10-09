import { compareVersions } from "../docs/news";
import { INSPIRATION, STUDIES } from "./content";
import { featuresOf, type Feature } from "./features";

// The archive at the bottom of the showcase (decision 172): every scene of the page, the
// studies included, with its capture, its name, what it is, the version of GSS it arrived
// with and the features it uses. Newest version first; within a version, the order of the
// lists. Built at build time only: reading the features needs the parser, which the page
// does not ship.

export type ArchiveEntry = {
  slug: string; // its capture: public/showcase/<slug>.jpg
  name: string;
  description: string;
  since: string;
  code: string;
  features: Feature[];
  study?: string; // a study opens in the viewer at the top of the page: showcase#<key>
};

export const ARCHIVE: ArchiveEntry[] = [
  ...STUDIES.map((study) => ({
    slug: study.key,
    name: study.title.replace(/\n/g, " ").replace(/\.$/, ""), // "Glass\nCircuit." → Glass Circuit
    description: study.description.replace(/\n/g, " "),
    since: study.since,
    code: study.scene,
    study: study.key,
  })),
  ...INSPIRATION,
]
  .map((entry) => ({ ...entry, features: featuresOf(entry.code) }))
  .sort((a, b) => compareVersions(b.since, a.since)); // stable: the order of the lists within a version
