# GSS — Plan d’optimisation et protocole de mesure

> Document de travail pour un LLM chargé d’auditer et d’améliorer GSS.
> Date : 2026-10-01. Langue : français.
> Ces pistes ne constituent pas un audit du code actuel. Vérifier leur pertinence dans le dépôt avant toute modification.

## 1. Mission et règles de travail

Améliorer les performances du moteur GSS en préservant le langage, les scènes existantes et la qualité visuelle. Séparer trois objectifs : rendu GPU, fluidité de l’interface et coût de compilation.

Instructions pour l’agent :

1. Lire les instructions du dépôt et identifier le parseur, la cascade, l’évaluation des expressions, la génération GLSL, le renderer et le playground. Ne pas inventer leurs chemins.
2. Lire le registre des fonctionnalités et les tests existants. Identifier les optimisations déjà présentes.
3. Instrumenter et enregistrer une baseline avant de modifier le moteur.
4. Identifier le goulot d’étranglement avec des mesures, pas avec le nombre de lignes de code.
5. Faire une modification mesurable à la fois. Conserver un chemin de référence pour les comparaisons.
6. Vérifier les cas limites géométriques, les matériaux, les animations et le survol.
7. Distinguer les optimisations à qualité identique des compromis de qualité. Ne pas présenter une baisse de résolution comme une accélération algorithmique.
8. Ne pas inventer de résultats, de gains, de support matériel ou de mesures GPU lorsque l’extension nécessaire manque.
9. Fournir un rapport avant/après avec configuration, résultats bruts, limites et décision de conserver ou retirer chaque changement.

Ne pas réécrire le moteur intégralement avant d’avoir mesuré. Ne pas migrer vers WebGPU par principe : changer d’API ne supprime pas le coût des évaluations SDF.

## 2. Contexte connu et modèle de coût

GSS décrit des scènes à l’aide d’une syntaxe inspirée du CSS : sélecteurs, cascade, groupes, variables et keyframes. La scène est compilée en GLSL et rendue par raymarching de champs de distance.

Le registre fourni documente notamment :

- cube, sphere, torus, cylinder, cone, capsule, plane, path, prism et group ;
- transformations, répétitions `* n`, `sibling-index()` et `sibling-count()` ;
- opérations union, subtract, intersect et jonctions adoucies via blend ;
- matériaux matte, metal, jelly, glass et variantes ;
- textures, survol et animations ;
- expressions statiques calculées à la compilation.

Ces informations décrivent le contrat documenté, pas l’implémentation interne actuelle.

Modèle conceptuel, non formule prédictive de temps :

`travail ≈ pixels × [pas primaires × coût(distance) + normales + éclairage + rayons secondaires]`

Un shader unique et un draw call unique n’impliquent pas un rendu peu coûteux. Une répétition concise dans le langage peut produire des centaines d’évaluations dans le shader. Compter les évaluations évitées est souvent plus utile que compter les multiplications supprimées.

## 3. Corriger les conseils génériques avant de les appliquer

| Conseil | Application correcte à GSS |
| --- | --- |
| « a * b + c est exécuté en un cycle » | Une fusion multiply-add peut être produite par le compilateur. Ni sa présence ni son coût ne sont universels. Le débit et la latence sont distincts. Mesurer sur les GPU cibles. |
| Utiliser mix et dot | Préférer les fonctions natives lorsqu’elles expriment le calcul voulu. Ne pas supposer qu’une réécriture équivalente produit toujours un shader plus rapide. |
| Remplacer length(v) par dot(v,v) | Pour comparer une distance à un rayon positif, comparer les carrés peut éviter une racine. Une distance au carré ne remplace pas la distance utilisée pour avancer le rayon. Cela peut faire traverser des surfaces. |
| Les swizzles sont gratuits | Ils sont généralement efficaces ; aucune raison d’en faire un chantier prioritaire sans preuve. |
| Utiliser discard tôt | Il peut éviter du travail restant, mais aussi nuire aux optimisations de visibilité selon le GPU. Tester. Une sortie anticipée avec la couleur de fond peut être mieux adaptée. |
| Ne jamais écrire gl_FragDepth | Les écritures de profondeur peuvent limiter le rejet précoce. Dans une passe plein écran, Early-Z ne connaît cependant pas les surfaces internes à la scène SDF avant leur calcul. Ne pas supprimer une profondeur nécessaire à une composition correcte. |
| Utiliser #define et #if | Utile pour spécialiser le code à la compilation. Le préprocesseur n’apporte pas de gain magique si le code inutile était déjà éliminé. Limiter le nombre de variantes. |
| Utiliser mediump partout | Tester une précision réduite sur les couleurs ou calculs secondaires. Maintenir une précision suffisante sur les positions, distances, transformations et accumulation des pas. Attention aux petits objets et grandes coordonnées. |
| Remplacer les branches par mix | mix n’est pas une garantie d’évaluation paresseuse. Calculer deux branches coûteuses pour choisir leur résultat peut être pire qu’une branche cohérente. |

## 4. Priorité absolue : mesurer les performances

### 4.1 Les métriques à distinguer

| Mesure | Méthode | Interprétation |
| --- | --- | --- |
| Intervalle de frame | Différence entre timestamps de requestAnimationFrame | Cadence observée, affectée par écran, navigateur et ordonnanceur. Ce n’est pas le temps GPU. |
| Travail CPU synchrone | performance.now autour d’une section | Temps CPU écoulé, incluant éventuellement de l’attente dans le pilote. |
| Temps GPU | Timer queries asynchrones | Durée des commandes GPU encadrées, pas toute la latence jusqu’à l’affichage. |
| Compilation GSS | Mesures séparées parsing/cascade/expressions/codegen | Coût de traitement du langage. |
| Compilation/link GLSL | Horodatage soumission → disponibilité du programme | Latence observée côté navigateur ; ne pas la confondre avec un chronométrage interne pur du compilateur GPU. |
| Réactivité d’édition | Modification → frame affichant la nouvelle scène | Latence utilisateur, comprenant debounce, compilation et rendu. |
| Résolution réelle | drawingBufferWidth × drawingBufferHeight | Nombre de pixels réellement rendus, distinct des dimensions CSS. |
| Distribution des pas | Shader de diagnostic | Localise convergence lente et zones coûteuses. Instrumentation à exclure des benchmarks de production. |

Ne pas additionner naïvement temps CPU et GPU : leur exécution peut se chevaucher. Une scène limitée à 60 FPS peut avoir un coût GPU de 4 ms ou de 15 ms.

### 4.2 Calculs à afficher

Pour N intervalles de frame valides `dt[i]` en millisecondes :

- FPS moyen observé : `1000 * N / sum(dt)`.
- Temps de frame : médiane, p95 et p99 des `dt`.
- Temps GPU : médiane et p95 des mesures GPU valides.
- Budget théorique à F FPS : `1000 / F` ms, soit environ 16,67 ms à 60 FPS et 8,33 ms à 120 FPS.
- Réduction de temps : `100 * (avant - apres) / avant`, à configuration identique.
- Facteur d’accélération : `avant / apres`.

Exemple : passer de 12 à 9 ms GPU représente une réduction de 25 % et une accélération de 1,33×. Cela n’implique pas une hausse visible des FPS si les deux cas restent limités par la fréquence de l’écran.

Ne pas moyenner les FPS instantanés `1000 / dt` pour obtenir les FPS globaux. Pour un indicateur « 1 % low », expliciter la convention employée ; `1000 / p99(dt)` est un indicateur de percentile, pas une définition universelle du 1 % low.

Exemple de statistiques simples :

```ts
function summarize(samplesMs: number[]) {
  const sorted = samplesMs.filter(x => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const percentile = (p: number) =>
    sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  const meanMs = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    count: sorted.length,
    meanMs,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  };
}
```

Pour les FPS, appliquer `1000 / meanMs` aux intervalles rAF uniquement. `1000 / meanGpuMs` n’est pas une mesure des FPS de l’application.

### 4.3 Mesure GPU WebGL 2 sans bloquer

Utiliser `EXT_disjoint_timer_query_webgl2` si disponible. La détection doit être optionnelle. L’absence de cette extension doit afficher « mesure GPU indisponible », pas 0 ms ni une mesure CPU renommée.

Schéma d’implémentation :

```ts
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');

// Début d’une frame échantillonnée :
const query = ext ? gl.createQuery() : null;
if (query && ext) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);

renderScene(); // Toutes les passes que l’on souhaite mesurer.

if (query && ext) {
  gl.endQuery(ext.TIME_ELAPSED_EXT);
  pendingQueries.push(query);
}

// Dans une frame ultérieure, sans boucle d’attente :
if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) {
  // Les timings sont invalides : jeter toutes les mesures en attente.
  for (const q of pendingQueries) gl.deleteQuery(q);
  pendingQueries.length = 0;
} else if (ext) {
  for (let i = pendingQueries.length - 1; i >= 0; i--) {
    const q = pendingQueries[i];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
    const nanoseconds = gl.getQueryParameter(q, gl.QUERY_RESULT);
    gpuSamplesMs.push(nanoseconds / 1_000_000);
    gl.deleteQuery(q);
    pendingQueries.splice(i, 1);
  }
}
```

Ce snippet illustre le mécanisme ; intégrer proprement le cycle de vie dans le renderer :

- Initialiser les tableaux et borner leur taille.
- Associer un identifiant de frame/scène à chaque query si nécessaire.
- Ne pas imbriquer deux queries TIME_ELAPSED sur le même contexte.
- Limiter la file d’attente, par exemple à 8 queries ; sauter un échantillonnage si elle est pleine.
- En cas d’exception de rendu, clôturer la query active avant de nettoyer.
- Gérer perte/restauration de contexte et redétecter l’extension.
- Ne pas appeler gl.finish pour mesurer : cela sérialise CPU/GPU et déforme les résultats.
- Ne pas lire QUERY_RESULT avant disponibilité, ni attendre dans une boucle.
- Mesurer l’effet de l’instrumentation elle-même ; échantillonner moins souvent en production.

Pour isoler différentes passes, utiliser des queries non imbriquées dans des sessions adaptées. Pour isoler ombres/reflets dans un shader monolithique, utiliser des variantes et des tests A/B : une query externe ne peut pas directement chronométrer une fonction interne GLSL.

### 4.4 Protocole reproductible

1. Fixer commit, scène, seed éventuelle, caméra et trajectoire d’animation.
2. Fixer taille CSS, drawing buffer, DPR, échelle de rendu et options de qualité.
3. Désactiver la résolution dynamique pendant les comparaisons algorithmiques.
4. Attendre le chargement des textures et la compilation ; faire une chauffe, par exemple 3–5 secondes.
5. Mesurer ensuite une séquence de 15–30 secondes ; conserver plusieurs cycles pour les animations.
6. Répéter au moins trois fois, en alternant référence et version optimisée pour limiter les biais thermiques.
7. Conserver les mesures brutes et présenter les résultats par répétition, puis leur synthèse.
8. Tester au minimum un GPU intégré de bureau et un appareil mobile réel disponible. Mentionner les appareils non testés.
9. Éviter les DevTools ouverts, captures vidéo et autres charges pendant le benchmark final.
10. Réinitialiser une session après onglet masqué ou perte de contexte. Ne pas supprimer les mauvaises frames arbitrairement.

Enregistrer navigateur/version, OS, appareil, état secteur/batterie si pertinent, fréquence d’écran et GPU lorsque disponible sans rendre sa détection obligatoire. Un rendu logiciel de CI peut vérifier des régressions fonctionnelles mais ne valide pas les performances des GPU utilisateurs.

### 4.5 Scènes de référence

- Une primitive matte : coût minimal du renderer.
- Répétitions de 10, 50 et 200 primitives : évolution du coût avec le nombre d’objets.
- Objets dispersés avec grands espaces vides : intérêt des bornes.
- Groupes imbriqués animés : coût des transformations.
- Union adoucie, soustraction et intersection : validité CSG.
- Paths/prisms complexes : coût géométrique.
- Matériaux métal, verre et jelly dans des scènes distinctes : effets secondaires.
- Géométries fines, caméra proche/lointaine et caméra dans un volume.
- Scène statique puis interactive avec hover.
- TIDAL, si disponible dans le dépôt, comme cas d’animation représentatif ; ne pas en faire le seul benchmark.

Ne pas supposer une montée en charge linéaire avec le nombre d’objets : leur couverture d’écran et leur organisation modifient aussi le coût.

## 5. Volumes englobants et accélération spatiale

### Objectif

Réduire l’espace parcouru et le nombre de primitives évaluées par point.

- Intersecter le rayon avec une boîte ou sphère englobant la scène finie.
- Sur un échec, retourner le fond ou traiter séparément le sol.
- Sur un succès, commencer à l’entrée et arrêter à la sortie du volume.
- Gérer les rayons parallèles aux faces et la caméra à l’intérieur du volume.
- Introduire ensuite des bornes par sous-arbre et éventuellement une BVH.

Les groupes constituent une structure initiale utile, mais une hiérarchie d’auteur n’est pas forcément une bonne hiérarchie spatiale.

Une borne de sous-arbre doit être conservatrice. Pour les unions, élaguer un sous-arbre seulement lorsque sa borne permet de prouver qu’il ne peut améliorer le résultat courant. Comparer soigneusement bornes signées, points intérieurs et meilleur résultat courant : un simple test arbitraire de proximité n’est pas une preuve.

Précautions :

- Inclure les animations : recalcul/refit ou enveloppe de mouvement conservatrice.
- Inclure l’expansion des blends selon leur formule réelle.
- Préserver les dépendances et l’ordre des opérations CSG.
- Ne pas supprimer les objets hors champ nécessaires aux reflets, ombres ou à une soustraction.
- Séparer le sol infini, avec intersection analytique rayon-plan lorsque compatible. Son ombrage doit rester correct.
- Mesurer le surcoût de traversal : une BVH peut être moins intéressante pour une toute petite scène.

## 6. Séparer distance, identification et shading

Auditer ce que calcule la fonction appelée à chaque pas. Reporter textures, éclairage et matériaux complexes après la recherche de surface.

Architecture conceptuelle, à adapter :

```glsl
float sceneDistance(vec3 p);
Surface sceneSurface(vec3 p);
vec3 shade(Surface surface, vec3 p);
```

Utiliser un chemin distance seule pour les normales, ombres et autres recherches lorsque c’est possible. Un identifiant de primitive peut être utile pendant la marche : comparer son coût à celui d’une nouvelle identification au point d’impact.

Les jonctions adoucies peuvent mélanger plusieurs matériaux. Reconstruire les contributions nécessaires au point d’impact, sans perdre la sémantique des soustractions et intersections. Ne pas remplacer un mélange par un matériau arbitraire pour gagner du temps.

## 7. Calculs invariants et transformations

Les expressions statiques sont déjà annoncées comme calculées à la compilation. Vérifier avant d’ajouter du constant folding redondant.

Rechercher surtout les calculs dépendant du temps, mais pas du point échantillonné :

- interpolation des keyframes ;
- sinus/cosinus des rotations ;
- matrices inverses ;
- transformations cumulées des groupes ;
- expressions partagées entre plusieurs propriétés.

Éviter leur recalcul dans chaque évaluation de distance lorsque possible. Comparer code GLSL factorisé et transformations préparées une fois par frame côté CPU puis transmises via uniforms/UBO ou une représentation adaptée.

Inclure le coût CPU, les uploads, les limites d’uniforms et la pression sur les registres dans la comparaison. Ne pas supposer que le compilateur pilote déplace automatiquement tout calcul invariant hors des boucles.

Conserver les distances correctes après transformation. Une mise à l’échelle uniforme demande un ajustement cohérent de la distance ; toute future échelle non uniforme exige des bornes sûres adaptées.

## 8. Répétitions spécialisées

Inspecter comment `cube.tile * 100` est compilé. Une expansion en 100 évaluations peut devenir coûteuse.

Pour des grilles ou anneaux réguliers, étudier le repliement du domaine vers une cellule locale et l’évaluation d’un motif partagé.

Conditions à prouver avant d’appliquer la spécialisation :

- disposition effectivement régulière ;
- limites finies correctement traitées ;
- taille et transformations compatibles ;
- cellules voisines prises en compte lorsque nécessaire ;
- préservation des identifiants, matériaux et interactions ;
- absence de dépendance CSG invalidant la simplification.

La cellule géométriquement la plus proche ne contient pas toujours la surface la plus proche. Grandes formes, variations de taille et débordements exigent plusieurs candidats ou le retour au chemin général.

Éviter également un déroulage systématique des grosses boucles : comparer taille du shader, temps de compilation et temps GPU. Court GLSL ne signifie pas automatiquement rapide, et inversement.

## 9. Rayons secondaires et normales

Attribuer des budgets indépendants au rayon principal, aux ombres, aux reflets, à la réfraction et à l’occlusion ambiante.

- Limiter explicitement distances et rebonds secondaires.
- Pour une ombre dure, terminer dès qu’un bloqueur valide est trouvé.
- Préserver la logique spécifique des ombres douces.
- Réduire les échantillons AO dans un profil de qualité identifié.
- Éviter toute branche de verre/reflet dans une variante qui n’en a pas besoin.

Pour les normales, comparer différence centrale (souvent 6 évaluations) et estimation tétraédrique (4 évaluations). La réduction locale ne correspond pas directement à une réduction équivalente du temps total. Vérifier silhouettes, surfaces brillantes et jonctions CSG.

Des gradients analytiques peuvent être intéressants pour des primitives simples, mais leur propagation à travers CSG, blends et transformations doit être correcte.

## 10. Tolérance liée aux pixels et algorithmes de marche

Un seuil fixe trop petit gaspille des pas sur des détails sous-pixel. Évaluer une tolérance tenant compte de l’empreinte du pixel à la distance considérée.

```glsl
float epsilon = max(minimumEpsilon,
                    pixelFootprintAtDistance(t) * tolerance);
```

`pixelFootprintAtDistance` est une fonction conceptuelle à dériver de la projection et de la résolution réelle ; elle n’est pas une fonction GLSL native.

Valider détails fins, objets lointains, contacts, scintillement temporel et auto-intersections. Une baisse de précision est un compromis visuel à rendre explicite.

Étudier ensuite Enhanced Sphere Tracing : over-relaxation sécurisée et sélection de candidats en espace écran. Ne pas appliquer `t += distance * 1.5` sans les conditions de sécurité et mécanismes de repli nécessaires.

Plus tard, explorer Segment Tracing avec bornes locales de Lipschitz. Ce chantier nécessite des garanties sur les primitives et opérateurs ; il ne doit pas précéder les optimisations simples mesurées.

## 11. Résolution, DPR et rendu à la demande

À taille CSS identique, DPR 2 représente quatre fois les pixels de DPR 1. Une échelle de rendu 0,75 sur chaque axe représente 0,5625 fois les pixels, soit 43,75 % de pixels en moins. Le temps GPU ne baisse pas nécessairement dans la même proportion.

Implémentations possibles :

- plafond de DPR configurable ;
- échelle de rendu indépendante des dimensions CSS ;
- résolution dynamique pilotée par des mesures filtrées ;
- hystérésis, limites et ajustements espacés pour éviter les oscillations ;
- rendu uniquement sur invalidation pour les scènes immobiles ;
- suspension lorsque le canvas est hors écran ou la page masquée ;
- reprise correcte sur animation, caméra, hover, resize ou chargement de texture.

La caméra automatique, les textures animées et les transitions éventuelles rendent une scène non statique. Définir le comportement temporel à la reprise plutôt que produire des sauts accidentels.

Mesurer séparément qualité maximale fixe et mode adaptatif. Une optimisation structurelle doit être comparée à résolution et qualité constantes.

## 12. Playground et compilation

Séparer modifications structurelles et valeurs pouvant être mises à jour sans recompiler le shader.

- Uniforms pour les paramètres dynamiques appropriés.
- Cache borné de programmes par structure et options de qualité.
- Génération des seules fonctions nécessaires.
- Nombre limité de variantes pour éviter l’explosion du cache.
- Parsing, cascade et codegen dans un Worker si les mesures montrent un blocage CPU.
- Debounce raisonnable pendant la saisie et abandon logique des résultats obsolètes.
- Conserver le dernier programme valide pendant la compilation du suivant.
- KHR_parallel_shader_compile lorsque disponible ; vérifier COMPLETION_STATUS_KHR de manière asynchrone.
- Éviter les vérifications synchrones de statut dans la boucle de rendu.
- Libérer programmes, shaders, textures et queries devenus inutiles.

Un Worker pour le compilateur GSS ne déplace pas automatiquement le contexte WebGL. OffscreenCanvas serait un chantier distinct, à justifier.

Mesurer compilation à froid et réutilisation de cache séparément. Ne pas prétendre contrôler complètement les caches internes du pilote.

## 13. Ordre de réalisation recommandé

| Étape | Livrable | Critère de décision |
| --- | --- | --- |
| P0 | Audit du chemin de rendu et baseline CPU/GPU | Goulot identifié et benchmark reproductible |
| P1 | DPR, résolution configurable, rendu à la demande | Gain mesuré, comportement et qualité explicités |
| P2 | Distance seule et report du shading | Réduction GPU à qualité identique |
| P3 | Bornes globales puis par groupes | Gain sur scènes représentatives sans trous ni erreurs CSG |
| P4 | Factorisation des transformations animées | Gain net incluant coût CPU et uploads |
| P5 | Budgets des effets, normales et tolérances | Profils de qualité vérifiés |
| P6 | Répétitions spécialisées et BVH plus avancée | Détection sûre et chemin général de repli |
| P7 | Compilation/caches et réactivité d’édition | Latence d’édition et absence de blocages améliorées |
| Recherche | Enhanced Sphere Tracing / Segment Tracing | Gain justifiant la complexité et garanties de correction |

Cet ordre est une hypothèse de départ. Si la baseline révèle que la compilation ou le picking bloque l’application, traiter ce problème plus tôt. Auditer notamment les readPixels synchrones éventuels du hover ; ne pas supposer que le rendu principal est le seul coût.

## 14. Validation et rapport attendu

Pour chaque modification :

1. Décrire le problème observé et l’hypothèse.
2. Indiquer les fichiers et fonctions effectivement modifiés.
3. Donner des mesures avant/après sur la même configuration.
4. Fournir captures à temps d’animation fixes et contrôle de séquences animées.
5. Vérifier caméra intérieure, tangences, géométries fines, CSG, blends et limites de répétition.
6. Signaler toute baisse de qualité ou limitation de compatibilité.
7. Conclure : conservée, ajustée ou abandonnée, avec raison.

Tableau conseillé :

| Scène | Appareil | Résolution | Qualité | GPU médiane avant/après | GPU p95 avant/après | CPU avant/après | Compilation avant/après | Écart visuel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| À mesurer | À renseigner | À renseigner | Fixe | Non mesuré | Non mesuré | Non mesuré | Non mesuré | À vérifier |

Ne pas imposer un pourcentage universel de gain. Retenir un changement lorsque son avantage dépasse la variabilité des mesures et que son coût de maintenance est justifié. Une amélioration sur un GPU peut régresser sur un autre.

## 15. Sources primaires et documentation

Les recommandations d’architecture ci-dessus sont des propositions pour GSS, pas des fonctionnalités attestées de son implémentation.

- MDN — WebGL best practices : https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
  Back buffer, précision, appels bloquants, compilation parallèle, haute densité et lecture asynchrone.
- Khronos — EXT_disjoint_timer_query_webgl2 : https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
  Mesure GPU asynchrone, disponibilité et invalidation disjoint.
- Khronos — EXT_disjoint_timer_query : https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query/
  Spécification de base et version WebGL 1.
- Arm — Immortalis-G925: The Fragment Pre-pass : https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/immortalis-g925-the-fragment-prepass
  Illustration des effets dépendant de l’architecture de discard, profondeur et visibilité précoce. Ne pas généraliser les détails du G925 à tous les GPU.
- Keinert et al., 2014 — Enhanced Sphere Tracing : https://diglib.eg.org/items/8ea5fa60-fe2f-4fef-8fd0-3783cb3200f0
  DOI : 10.2312/stag.20141233. Over-relaxation sécurisée, bornes convexes et métrique écran.
- Galin et al., 2020 — Segment Tracing Using Local Lipschitz Bounds : https://diglib.eg.org/items/e18f85b8-1d88-4e40-9799-85babda84cbe
  DOI : 10.1111/cgf.13951. Bornes locales pour réduire les évaluations du champ.
- Microsoft — Optimizing HLSL Shaders : https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-optimize
  Principes généraux de réduction du travail et de branchement ; adapter à GLSL/WebGL, ne pas transposer aveuglément les détails HLSL.

## Directive finale pour l’agent

Commencer par produire une cartographie du moteur et une baseline. Choisir ensuite le changement offrant le meilleur gain mesuré pour une complexité raisonnable. Ne pas optimiser des instructions isolées pendant que chaque pixel continue d’évaluer inutilement toute la scène à chaque pas.
