# Movix pour TizenBrew

Module TizenBrew (**Site Modification Module**) pour regarder **[Movix](https://movix.fun)**
sur Samsung Smart TV (Tizen), avec navigation à la télécommande.

> Based on the original [movix-tizenbrew](https://github.com/Mathr81/movix-tizenbrew)
> project by **Mathr81**. This fork updates the module format for compatibility with
> current versions of TizenBrew.

## Fonctionnalités

- Navigation D-pad complète (↑ ↓ ← → + OK + Retour)
- Anneau de focus rouge visible sur tous les éléments
- Contrôle direct du lecteur vidéo (play/pause, ±10 s, stop, volume)
- Touches couleurs comme raccourcis :
  - 🔴 Rouge → Recherche
  - 🟢 Vert → Accueil
  - 🟡 Jaune → À voir
  - 🔵 Bleu → Favoris
- Adaptation visuelle TV (tailles de cible, scrollbar masquée, curseur masqué)
- Blocage des pubs, popups, redirections et pièges à clic (voir plus bas)

## Blocage des pubs

Activé par défaut. Pour tout désactiver, passer `ADBLOCK` à `false` en haut de
`inject.js`.

| Bloqué | Comment |
|---|---|
| Popups / popunders | `window.open()` renvoie `null` |
| Popunders et redirections forcées des lecteurs embarqués | Les iframes tierces reçoivent un `sandbox` **sans** `allow-popups` ni `allow-top-navigation` |
| Pubs et pixels de tracking invisibles | Les iframes masquées ou plus petites que 50×50 px sont supprimées |
| Pubs invisibles qui volent le clic OK | Les overlays plein écran, `z-index ≥ 1000`, sans contenu utilisable, sont supprimés en continu |
| Départ du site vers un domaine tiers | Les clics sur les liens externes sont annulés |

**Ce qui n'est pas bloqué**, en toute honnêteté : les pubs insérées directement
dans le flux vidéo côté serveur, et les pubs servies depuis le même domaine que
le site. Aucun bloqueur côté page ne peut les distinguer du contenu.

Effet de bord : les liens externes du pied de page (Telegram, GitHub, miroirs
comme `movix.online`) ne répondent plus. C'est voulu — sur une TV, quitter
Movix laisse l'utilisateur bloqué sans navigateur.

Testé sur `movix.fun` : une seule iframe 1×1 supprimée, les 8 lecteurs vidéo,
23 boutons, 55 liens et 39 images de la page d'accueil intacts.

## Installation depuis GitHub

1. Installer et ouvrir **TizenBrew** sur la Samsung TV.
2. Ouvrir le **gestionnaire de modules**.
3. Sélectionner **Ajouter un Module GitHub**.
4. Entrer :

   ```
   Bulbabulbe/tizen-movix@main
   ```

   Format générique si vous forkez : `VOTRE_USERNAME_GITHUB/NOM_DU_REPO@main`.

5. Revenir au menu principal et lancer **Movix**.

### Figer une version

`@main` suit la branche : chaque `git push` change ce que la TV télécharge.
Pour figer une version précise, remplacez `main` par un **commit SHA** (ou un tag) :

```
Bulbabulbe/tizen-movix@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

C'est recommandé une fois que le module fonctionne, pour éviter qu'une mise à jour
cassée ne se propage automatiquement sur la TV.

Les fichiers sont servis par jsDelivr. Vous pouvez vérifier depuis un navigateur
que le dépôt est bien lisible :

- `https://cdn.jsdelivr.net/gh/Bulbabulbe/tizen-movix@main/package.json`
- `https://cdn.jsdelivr.net/gh/Bulbabulbe/tizen-movix@main/inject.js`

Les deux doivent renvoyer le contenu du fichier, pas une erreur 404.

## Raccourcis télécommande

| Touche | Hors lecteur | Dans le lecteur |
|--------|--------------|-----------------|
| ↑ ↓ | Navigation | Volume + / − |
| ← → | Navigation | −10 s / +10 s |
| OK | Sélectionner | Play / Pause |
| Retour | Page précédente | Quitter le lecteur |
| ⏯ ⏵ ⏸ | — | Play / Pause |
| ⏩ ⏪ | — | +10 s / −10 s |
| ⏹ | — | Stop (retour au début) |
| 🔴 | Recherche | — |
| 🟢 | Accueil | — |
| 🟡 | À voir | — |
| 🔵 | Favoris | — |

Quand un champ de saisie a le focus, ← et → déplacent le curseur dans le texte
et OK valide, au lieu de naviguer dans la page.

## Structure du dépôt

```
tizen-movix/
├── package.json   → Configuration du module TizenBrew
├── inject.js      → Script injecté (navigation, lecteur, CSS embarqué)
├── inject.css     → Source de référence du CSS (non chargé à l'exécution)
├── README.md
└── LICENSE
```

### Pourquoi le CSS est-il dans `inject.js` ?

Le format actuel d'un module `mods` ne documente **qu'un seul** fichier chargé,
via le champ `main`. Il n'existe pas de champ `injectStyle`. Le CSS est donc
injecté par `inject.js` dans un `<style id="movix-tizenbrew-style">` ajouté à
`document.head`, avec une garde anti-doublon.

`inject.css` reste dans le dépôt comme source lisible/diffable. **Si vous le
modifiez, reportez la modification dans la constante `CSS` de `inject.js`** —
c'est cette copie-là qui est exécutée.

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
délivrées par défaut à la page, seules les touches médias et couleurs doivent
être enregistrées auprès de l'API TVInputDevice.

## Dépannage

**Le module apparaît comme « Unknown Module »**
C'est l'ancienne entrée `npm/movix-tizenbrew`, qui utilise un format de
`package.json` que TizenBrew ne lit plus. Supprimez-la dans le gestionnaire de
modules, **redémarrez TizenBrew**, puis ajoutez la version GitHub ci-dessus.

**Le module n'apparaît pas du tout après l'ajout**
- Vérifiez que le dépôt GitHub est **PUBLIC** (jsDelivr ne sert pas les dépôts privés).
- Vérifiez que `package.json` est à la **racine** du dépôt, pas dans un sous-dossier.
- Vérifiez que `inject.js` est à la **racine** également, puisque `"main": "inject.js"`.
- Vérifiez que la branche indiquée après `@` existe réellement (`main`, pas `master`).
- Ouvrez les deux URLs jsDelivr ci-dessus dans un navigateur : si elles renvoient
  404, le module ne peut pas se charger. jsDelivr met quelques minutes à voir un
  tout nouveau commit.

**Le module se lance mais la télécommande ne fait rien**
Le site a probablement changé de structure. Les sélecteurs sont regroupés en haut
de `inject.js` (constante `FOCUSABLE`) et dans `handleColorKeys` / `initFocus`.

**Les touches couleurs ne répondent pas**
Elles ne fonctionnent que sur une vraie TV : `tizen.inputdevice` n'existe pas
dans un navigateur de bureau.

## Crédits

- Projet original : [Mathr81/movix-tizenbrew](https://github.com/Mathr81/movix-tizenbrew)
- TizenBrew : [reisxd/TizenBrew](https://github.com/reisxd/TizenBrew)

Licence MIT (voir [LICENSE](LICENSE)), reprise de la licence déclarée par le projet original.

Ce module n'ajoute aucune analytics, publicité, télémétrie, dépendance npm ni
appel réseau. Il ne communique qu'avec le site Movix chargé par TizenBrew : tout
le blocage de pubs se fait localement, en manipulant le DOM de la page.

**Si le site change de domaine** (`movix.fun` → autre) : une simple redirection
HTTP est gérée toute seule, TizenBrew réinjecte le script sur la page d'arrivée
quel que soit le domaine. Ce n'est qu'en cas de disparition du domaine sans
redirection qu'il faut modifier `websiteURL` dans `package.json`.
