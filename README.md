# Movix pour TizenBrew

Module TizenBrew (**Site Modification Module**) pour regarder **[Movix](https://movix.fun)**
sur Samsung Smart TV (Tizen), avec un curseur piloté à la télécommande.

> Based on the original [movix-tizenbrew](https://github.com/Mathr81/movix-tizenbrew)
> project by **Mathr81**. This fork updates the module format for compatibility with
> current versions of TizenBrew.

## Fonctionnalités

- **Curseur virtuel** déplacé aux flèches, OK pour cliquer — Movix est un site
  conçu pour la souris, le curseur atteint donc 100 % de la page
- **Défilement par les bords** : le curseur doit être *collé* au bord de l'écran
  pour que ça défile — en haut/bas la page, à gauche/droite la rangée de films
  (les carrousels affichent 1118 px sur 8944 de contenu). Tant qu'il n'est pas
  au bord, rien ne bouge : on peut donc s'arrêter sur la barre de navigation
- **Sortir du champ de recherche** : haut, bas, ou Retour
- Contrôle direct du lecteur vidéo (play/pause, ±10 s, stop, volume)
- Touches couleurs comme raccourcis (🔴 Recherche, 🟢 Accueil, 🟡 À voir, 🔵 Favoris)
- Blocage des pubs, popups, redirections et pièges à clic
- Adaptation TV (vidéos décoratives figées, scrollbar et curseur natif masqués)

### Pourquoi un curseur plutôt qu'une navigation par focus ?

Les versions précédentes déplaçaient un anneau de focus d'un élément à l'autre
avec un algorithme directionnel. Deux problèmes : le résultat restait
approximatif sur les grilles de cartes, et tout reposait sur une liste de
sélecteurs CSS qui casse dès que Movix change ses classes.

Le curseur ne dépend d'aucun sélecteur. Mesuré sur `movix.fun` : traversée de
l'écran en 0,85 s, et un clic synthétique sur « Films » déclenche bien la
navigation React vers `/movies`.

## Raccourcis télécommande

Une seule règle, valable partout, y compris pendant un film : **les flèches
déplacent toujours le curseur, les touches médias pilotent toujours la vidéo.**

| Touche | Effet |
|--------|-------|
| ↑ ↓ ← → | Déplacent le curseur (accélère si maintenu) |
| Curseur collé au bord ↑ ou ↓ | Fait défiler la page |
| Curseur collé au bord ← ou → | Fait défiler la rangée de films |
| OK | Clic à la position du curseur — **sur le film, bascule le plein écran** |
| Retour | Page précédente, ou sortie du champ de recherche |
| ⏯ ⏵ ⏸ | Play / Pause |
| ⏩ ⏪ | +10 s / −10 s |
| ⏹ | Stop (retour au début) |
| 🔴 | Recherche |
| 🟢 | Accueil |
| 🟡 | À voir |
| 🔵 | Plein écran (raccourci, voir ci-dessous) |

### Plein écran : trois façons, la première suffit

1. **Amener le curseur sur le film et appuyer sur OK.** C'est tout. Un second
   OK au même endroit ressort du plein écran.
2. Le bouton **⛶** en bas à droite, qui apparaît dès qu'un lecteur est présent.
3. La touche 🔵 bleue.

Pourquoi OK sur le film ? Parce que c'est le seul geste utile à cet endroit :
quand le lecteur est une iframe d'un autre domaine, un clic de synthèse n'entre
pas dans son document et ne ferait donc strictement rien. Et parce que sur une
Samsung One Remote, atteindre la touche bleue demande **trois appuis** sur le
bouton « 123 / points colorés » (une fois pour les réglages rapides, deux fois
pour le pavé numérique, trois fois pour les touches couleurs) — inutilisable au
quotidien.

Pourquoi fabriquer ce bouton plutôt qu'utiliser celui du lecteur ? Deux raisons
vérifiées :

1. **Movix n'en a pas.** Son bundle JavaScript de 304 ko ne contient aucune
   occurrence de `requestFullscreen`, `exitFullscreen` ni `fullscreenElement`.
2. **Les commandes d'un lecteur embarqué sont hors d'atteinte du curseur.**
   Quand le lecteur est une iframe d'un autre domaine, `elementFromPoint`
   renvoie l'élément `<iframe>`, pas son contenu : un clic de synthèse n'entre
   pas dans le document embarqué. Aucun curseur injecté depuis la page parente
   ne peut cliquer les boutons d'un lecteur tiers.

Le bouton, lui, appartient à notre document, donc le curseur l'atteint. Il
appelle `requestFullscreen()` sur la vidéo, ou sur l'iframe qui la contient —
ce qui, depuis la page parente, fonctionne même en cross-origin. `allowfullscreen`
est ajouté aux iframes au passage, sans quoi l'appel serait refusé.

**Le curseur n'est jamais masqué, jamais estompé, jamais désactivé.** Chaque
tentative d'être malin là-dessus — le masquer pendant la lecture, l'effacer
après inactivité — a fini par laisser l'utilisateur sans pointeur.

### Il n'y a plus de « mode lecteur »

C'était la cause des blocages complets. Jusqu'en v4.3, dès qu'une vidéo était
détectée, toutes les touches partaient au lecteur et le gestionnaire sortait
immédiatement, curseur masqué. Si la vidéo se relançait seule, ou si OK
n'arrivait pas à la mettre en pause, plus rien ne répondait : il fallait tuer
l'application.

La règle appliquée est maintenant celle de la [Magic Remote de
LG](https://webostv.developer.lge.com/develop/guides/magic-remote), qui fait
référence sur le sujet : **une flèche ramène toujours le pointeur**. Aucun état
du lecteur ne peut confisquer les flèches, et le curseur reste utilisable
par-dessus une vidéo en lecture — ce qui permet justement de cliquer les
commandes du lecteur de Movix.

Pour avancer ou reculer dans un film, ce sont les touches ⏩ ⏪ de la
télécommande, déclarées dans `keys`.

**Champ de recherche et connexion** : les flèches continuent de déplacer le
curseur, même quand un champ a le focus. La saisie passe par le clavier virtuel
de Tizen, qui intercepte les touches avant la page ; rendre les flèches au champ
ne servait donc à rien et privait du curseur en pleine connexion.

**Le focus est maintenu dans le document principal.** S'il partait dans une
iframe tierce, notre écouteur de touches ne recevait plus rien : le lecteur
embarqué interprétait les flèches lui-même — montant le son ou avançant dans le
film — pendant que le curseur paraissait mort.

### Connexion Google

Google refuse l'authentification OAuth depuis une WebView embarquée et affiche
« navigateur non sécurisé » (`disallowed_useragent`). C'est une politique de
Google, pas un défaut du module, et aucun réglage de TizenBrew n'y change quoi
que ce soit : ses trois User-Agents prédéfinis sont des agents Cobalt/Tizen,
que Google rejette également.

La seule voie fiable est de créer le compte Movix avec **e-mail + mot de passe**
depuis un PC ou un téléphone, puis de se connecter ainsi sur la TV.

Le module, lui, ne bloque pas ce parcours : les domaines d'authentification
(`accounts.google.com`, `appleid.apple.com`, etc.) sont explicitement exclus du
blocage des liens externes et des popups.

## Blocage des pubs

Activé par défaut. Pour tout désactiver, passer `ADBLOCK` à `false` en haut de
`inject.js`.

| Bloqué | Comment |
|---|---|
| Popunders | `window.open()` renvoie `null` s'il n'y a pas eu d'appui sur OK dans la seconde précédente |
| Redirections forcées des lecteurs embarqués | Les iframes tierces reçoivent un `sandbox` **sans** `allow-popups` ni `allow-top-navigation` |
| Pixels de tracking | Les iframes minuscules greffées directement sur `<body>` sont supprimées |
| Pubs invisibles qui volent le clic OK | Les overlays plein écran, `z-index ≥ 1000`, sans contenu utilisable, sont supprimés |
| Départ du site vers un domaine tiers | Les clics sur les liens externes sont annulés |

### Ce qui passe volontairement

**Les popups que vous déclenchez vous-même.** La page de lecture de Movix
affiche « Une fenêtre publicitaire va s'ouvrir : tu peux la fermer dès qu'elle
apparaît » avec un bouton **Voir une publicité**, et ne charge la vidéo
qu'ensuite. Un blocage total de `window.open` empêchait donc **tout film de
démarrer**. La règle appliquée est celle d'un bloqueur de popups classique :
une popup ouverte dans la seconde qui suit un appui sur OK passe, celles qui
partent d'un minuteur ou d'un événement de fond restent bloquées.

Les domaines d'authentification passent également, sans quoi la connexion au
compte serait impossible.

**Une iframe n'est supprimée que si elle est minuscule *et* greffée directement
sur `<body>`** — la signature d'un pixel traceur (celui de Movix est un 1×1 sans
`src`). Un lecteur vidéo vit dans la mise en page et peut mesurer 0×0 le temps
de se charger : le supprimer sur sa seule taille serait fatal à la lecture.

**Ce qui n'est pas bloqué**, en toute honnêteté : les pubs insérées directement
dans le flux vidéo côté serveur, et les pubs servies depuis le même domaine que
le site. Aucun bloqueur côté page ne peut les distinguer du contenu.

Effet de bord : les liens externes du pied de page (Telegram, GitHub, miroirs
comme `movix.online`) ne répondent plus. C'est voulu — sur une TV, quitter
Movix laisse l'utilisateur bloqué sans navigateur.

Testé sur `movix.fun` : une seule iframe 1×1 supprimée, les 8 lecteurs vidéo,
23 boutons, 55 liens et 39 images de l'accueil intacts.

## Fluidité sur TV

Un CPU de Samsung TV est 10 à 20 fois plus lent qu'un PC. Le principal gain
vient de `PAUSE_DECOR_VIDEOS` (en haut de `inject.js`) : la page d'accueil
décore ses cartes avec **huit MP4 en boucle** (logos Netflix, Disney+, Apple
TV…, servis par giphy et tenor). Invisible sur PC, huit boucles vidéo en fond
suffisent à saccader toute l'interface d'une TV. Le lecteur n'est jamais touché.

Autres points, sans réglage :

- **Le pas du curseur est plafonné à 26 px** (`MAX_STEP`). C'est le correctif le
  plus important : le pas vaut vitesse × temps écoulé, donc quand la TV
  n'arrivait pas à suivre, les ticks se décalaient et le curseur se téléportait.
  Mesuré sur un tick arrivant avec 120 ms de retard : **120 px d'un seul coup,
  soit 110 px hors écran avant d'être ramené par la limite** — ce va-et-vient
  était la vraie source du tremblement pendant le défilement. Plafonné, un
  ralentissement de la TV ralentit le curseur au lieu de le faire sauter
  (26 px, 16 px de dépassement). La traversée d'écran passe de 0,85 s à 1,17 s.
- Le défilement n'est appliqué qu'à **30 Hz** (`SCROLL_INTERVAL`), pas à chaque
  tick : même vitesse moyenne, deux fois moins d'opérations, chacune deux fois
  plus grande. Soixante repaints par seconde dépassaient les moyens du panneau.
- Le curseur n'est redessiné que si sa position **au pixel près** a changé — il
  reste immobile pendant tout un défilement de bord.
- La boucle du curseur utilise `setInterval` et non `requestAnimationFrame` :
  rAF est suspendu dès que la WebView ne se juge pas visible, et un curseur figé
  rendrait la télécommande inutilisable. Les déplacements sont calculés en
  pixels par seconde, donc identiques quel que soit le taux de rafraîchissement.
- La boucle s'arrête dès qu'aucune flèche n'est maintenue : rien ne tourne au repos.
- Le balayage anti-pub ne se relance que si le DOM a bougé (0,7 ms mesuré).
- Le curseur se déplace en `transform`, sans recalcul de mise en page.

## Installation depuis GitHub

1. Installer et ouvrir **TizenBrew** sur la Samsung TV.
2. Ouvrir le **gestionnaire de modules**.
3. Sélectionner **Ajouter un Module GitHub**.
4. Entrer **un tag de version**, pas `main` :

   ```
   Bulbabulbe/tizen-movix@v4.0.1
   ```

   Format générique si vous forkez : `VOTRE_USERNAME_GITHUB/NOM_DU_REPO@vX.Y.Z`.
   Ne pas taper `gh/` devant : TizenBrew l'ajoute lui-même.

5. Revenir au menu principal et lancer **Movix**.

### Toujours utiliser un tag, jamais `@main`

jsDelivr, qui sert les fichiers à TizenBrew, ne traite pas les deux de la même
façon. Vérifié sur les en-têtes de réponse :

| Référence | `X-JSD-Version-Type` | Cache CDN |
|---|---|---|
| `@main` | `branch` | `s-maxage=43200` → jusqu'à **12 h de retard** |
| `@v4.0.1` | `version` | `immutable`, récupéré à la demande |

Avec `@main`, un `git push` peut mettre une demi-journée à atteindre la TV, et
il n'y a aucun moyen fiable de forcer la mise à jour (l'endpoint
`purge.jsdelivr.net` existe mais peut mettre longtemps à se propager).

Un tag est servi immédiatement et ne changera jamais de contenu. Un commit SHA
fonctionne aussi mais reste illisible sur une télécommande.

**Ne jamais déplacer un tag déjà publié** : jsDelivr le met en cache un an en
`immutable`, il continuerait à servir l'ancien contenu. Pour publier une
correction, créer un nouveau tag :

```bash
git tag -a v4.0.2 -m "correction" && git push origin v4.0.2
```

puis saisir `Bulbabulbe/tizen-movix@v4.0.2` sur la TV.

### Et via npm ?

Aucun intérêt ici. Un module npm sans numéro de version subit le même cache de
résolution, et avec un numéro il est traité exactement comme un tag Git — même
type `version`, même `immutable`. En échange il faudrait un compte npm, un
`npm publish` à chaque correction, et un paquet public de plus à maintenir.
Un `git tag` fait la même chose en une commande.

### Vérifier avant d'aller sur la TV

- `https://cdn.jsdelivr.net/gh/Bulbabulbe/tizen-movix@v4.0.1/package.json`
- `https://cdn.jsdelivr.net/gh/Bulbabulbe/tizen-movix@v4.0.1/inject.js`

Les deux doivent renvoyer le contenu du fichier, pas une erreur 404.

## Structure du dépôt

```
tizen-movix/
├── package.json   → Configuration du module TizenBrew
├── inject.js      → Script injecté (curseur, lecteur, anti-pub, CSS embarqué)
├── inject.css     → Source de référence du CSS (non chargé à l'exécution)
├── README.md
└── LICENSE
```

### Pourquoi le CSS est-il dans `inject.js` ?

Le format actuel d'un module `mods` ne documente **qu'un seul** fichier chargé,
via le champ `main`. Il n'existe pas de champ `injectStyle`. Le CSS est donc
injecté par `inject.js` dans un `<style id="movix-tizenbrew-style">` ajouté à
`document.head`, avec une garde anti-doublon.

`inject.css` reste dans le dépôt comme source lisible. **Si vous le modifiez,
reportez la modification dans la constante `CSS` de `inject.js`** — c'est cette
copie-là qui est exécutée.

## Configuration TizenBrew

```json
{
  "packageType": "mods",
  "appName": "Movix",
  "websiteURL": "https://movix.fun",
  "main": "inject.js",
  "keys": ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
           "MediaFastForward", "MediaRewind",
           "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue"]
}
```

Pas de `serviceFile` : ce module n'a besoin d'aucun service Node.js côté TV.

Les flèches, OK et Retour ne sont pas listées dans `keys` : elles sont déjà
délivrées par défaut à la page. Seules les touches médias et couleurs doivent
être enregistrées auprès de l'API TVInputDevice.

## Dépannage

**Le module apparaît comme « Unknown Module »**
C'est l'ancienne entrée `npm/movix-tizenbrew`, au format que TizenBrew ne lit
plus (sans `packageType`, son `moduleLoader.js` renvoie littéralement
`appName: 'Unknown Module'`). Supprimez-la, **redémarrez TizenBrew**, puis
ajoutez la version GitHub.

**Le module n'apparaît pas du tout après l'ajout**
- Le dépôt GitHub doit être **PUBLIC** (jsDelivr ne sert pas les dépôts privés).
- `package.json` et `inject.js` doivent être à la **racine** du dépôt.
- La branche après `@` doit exister (`main`, pas `master`).
- Ouvrez les URLs jsDelivr ci-dessus : si elles renvoient 404, le module ne peut
  pas se charger. jsDelivr met quelques minutes à voir un nouveau commit.

**Le curseur ne bouge pas**
Vérifiez dans la console que `[Movix TizenBrew v4.0] curseur actif` s'affiche.
Si le curseur est visible mais immobile, c'est la boucle de déplacement :
`SPEED_MIN` et `SPEED_MAX` sont en haut de `inject.js`.

**Le curseur est trop lent ou trop rapide**
`SPEED_MIN` (départ, précision) et `SPEED_MAX` (maintenu, vitesse de pointe) en
haut de `inject.js`. `ACCEL` règle la montée en vitesse, `EDGE` la distance au
bord qui déclenche le défilement.

**La vidéo ne se lance plus**
Passer `ADBLOCK` à `false` : c'est la mise en sandbox des iframes tierces qui
est la plus susceptible de gêner un lecteur embarqué.

**Les touches couleurs ne répondent pas**
Elles ne fonctionnent que sur une vraie TV : `tizen.inputdevice` n'existe pas
dans un navigateur de bureau.

## Crédits

- Projet original : [Mathr81/movix-tizenbrew](https://github.com/Mathr81/movix-tizenbrew)
- TizenBrew : [reisxd/TizenBrew](https://github.com/reisxd/TizenBrew)

Licence MIT (voir [LICENSE](LICENSE)), reprise de la licence déclarée par le
projet original.

Ce module n'ajoute aucune analytics, publicité, télémétrie, dépendance npm ni
appel réseau. Il ne communique qu'avec le site Movix chargé par TizenBrew : le
blocage de pubs et le curseur se font entièrement localement, dans le DOM.

**Si le site change de domaine** (`movix.fun` → autre) : une simple redirection
HTTP est gérée toute seule, TizenBrew réinjecte le script sur la page d'arrivée
quel que soit le domaine. Ce n'est qu'en cas de disparition du domaine sans
redirection qu'il faut modifier `websiteURL` dans `package.json`.
