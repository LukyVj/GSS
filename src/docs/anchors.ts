// The anchors of the parts of a page: written in the HTML at build, so the search (which reads
// the page without its script) lands on them, and given again by "On this page" in the browser.

// "From mount()" → "from-mount": the anchor of a chapter
const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// "material", "Values" → "material--values"
export const chapterAnchor = (page: string, title: string) => `${page}--${slug(title)}`;

// "material", 1 → "material--example-2": examples are counted from 1
export const exampleAnchor = (page: string, index: number) => `${page}--example-${index + 1}`;
