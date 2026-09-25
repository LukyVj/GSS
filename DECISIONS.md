# Décisions de design

## 1. Rendu par raymarching, sans Three.js

**Décision** : toute la scène est compilée en un seul fragment shader GLSL, rendu par raymarching de SDF (WebGL2).
**Pourquoi** : pas de dépendance, runtime minuscule, formes organiques (union lisse) impossibles en raster simple.
**Limite assumée** : pas de modèles importés (GLTF), coût qui monte avec le nombre d'objets.
**Plus tard** : un backend WGSL/WebGPU, grâce à une étape intermédiaire séparée du GLSL.

## 2. La structure dans `@scene`, pas en HTML

**Décision** : les objets sont déclarés dans un bloc `@scene { cube.corner * 4; }`.
**Pourquoi** : un seul fichier autonome, facile à partager et à générer par un LLM. Pas de web components.

## 3. Les ids multipliés sont numérotés automatiquement

**Décision** : `torus#hero * 3` crée `hero-1`, `hero-2`, `hero-3`. Sans multiplicateur, l'id reste `hero`.
**Pourquoi** : pratique, jamais d'erreur bloquante, chaque objet reste ciblable.
**Question ouverte** : `#hero` doit-il cibler les trois instances ?

## 4. Spécificité : id 10 000, classe 100, tag 1

**Décision** : la spécificité est un seul nombre, avec des poids très écartés.
**Pourquoi** : comme en CSS, aucun nombre réaliste de classes ne bat un id, et `#hero.big` bat `#hero`.
À spécificité égale, la dernière règle du fichier gagne.

## 5. Tout ce qui peut être calculé à la compilation l'est

**Décision** : la cascade, les sélecteurs et les unités (`70deg` → radians) sont résolus par le compilateur.
Le shader ne reçoit que des valeurs finales.
**Pourquoi** : shader plus simple et plus rapide ; le GPU ne sait rien du CSS.

## 6. JavaScript garde l'état, le shader dessine

**Décision** : la caméra, le temps et, plus tard, le survol et les animations vivent en TypeScript,
et sont envoyés au shader sous forme d'uniforms à chaque image.
**Pourquoi** : un shader n'a aucune mémoire d'une image à l'autre.

## 7. Un numéro de matériau par objet

**Décision** : chaque instance a son propre numéro (son index dans la scène), utilisé par `getColor`.
**Pourquoi** : les numéros sont toujours cohérents, et chaque objet reste identifiable, ce qui sera nécessaire pour `:hover`.

## 8. L'AST garde les valeurs brutes

**Décision** : le parser stocke les sélecteurs et les valeurs sous forme de tokens, sans les interpréter.
**Pourquoi** : le parser ne comprend que la structure ; le sens est donné plus tard, par la cascade et la génération.

## Questions ouvertes

- **Le nom** : « CSL » est déjà pris par le Citation Style Language, y compris l'extension `.csl`. Il faut un nom court unique.
- **Le décor** : le sol et le fond sont codés en dur dans le template. Prévu : `scene { floor: ...; background: ...; }`.
