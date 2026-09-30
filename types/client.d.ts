// `import scene from "./logo.gss"` with the plugin gss-lang/vite.
// In tsconfig.json: "types": ["gss-lang/client"]
declare module "*.gss" {
  const scene: import("gss-lang/runtime").CompiledScene;
  export default scene;
}
