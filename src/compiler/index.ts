import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { resolveStyles, resolveSceneStyles } from "./resolve";
import { generateShader } from "./codegen";
import { validateProperties, validateKeyframes } from "./validate";
import { readCamera, type CameraSettings } from "./camera";

// Everything the runtime needs to display a scene
export type CompiledScene = {
  shader: string;
  camera: CameraSettings;
  objects: number; // instances drawn, for the status bar (decision 42)
};

// GSS text → shader + camera settings
export function compileScene(source: string): CompiledScene {
  const stylesheet = parse(tokenize(source));
  validateProperties(stylesheet.rules);
  validateKeyframes(stylesheet.keyframes);
  const instances = expandScene(stylesheet.scene);
  const styled = resolveStyles(instances, stylesheet.rules);
  const sceneStyles = resolveSceneStyles(stylesheet.rules);
  return {
    shader: generateShader(styled, sceneStyles, stylesheet.keyframes),
    camera: readCamera(sceneStyles),
    objects: instances.length,
  };
}

// GSS text → shader only
export function compileGSS(source: string): string {
  return compileScene(source).shader;
}
