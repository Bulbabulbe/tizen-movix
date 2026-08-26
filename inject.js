/**
 * Movix TizenBrew — inject.js v6.3
 * Basé sur https://github.com/Mathr81/movix-tizenbrew (auteur original : Mathr81).
 * Ce fork met le module au format TizenBrew actuel (packageType "mods") et
 * embarque le CSS directement ici, car TizenBrew ne charge qu'un seul fichier
 * JS (champ "main"). inject.css reste dans le dépôt comme source de référence.
 *
 * v4 : la navigation par focus est remplacée par un curseur virtuel.
 * Movix est un site pensé pour la souris ; viser les éléments avec un
 * algorithme directionnel restait approximatif et cassait dès que Movix
 * changeait ses classes CSS. Un curseur atteint 100 % de la page et ne dépend
 * d'aucun sélecteur. Le défilement se fait en poussant le curseur contre le
 * haut ou le bas de l'écran.
 *
 *  - Flèches             → déplacent le curseur (accélère si on maintient)
 *  - Bord haut/bas       → défile par paliers, curseur collé au bord
 *  - Bord gauche/droite  → fait défiler la rangée de films sous le curseur
 *  - Le curseur          → jamais masqué, jamais estompé, jamais désactivé
 *  - OK                  → clic à la position du curseur
 *  - Retour              → page précédente, et ramène toujours sur Movix
 *  - Touches médias      → contrôlent la vidéo ; ▶ clique le bouton de lecture
 *                          quand la <video> est hors de portée (lecteur iframe)
 *  - Plein écran         → touche bleue uniquement
 *  - Touches couleurs    → Recherche / Accueil / À voir
 *  - Anti-pub            → réactivé. window.open renvoie un LEURRE (technique
 *                          du scriptlet uBlock « window.open-defuser ») : le
 *                          script de pub reçoit un vrai objet Window, ses
 *                          vérifications passent, aucun onglet ne s'ouvre.
 *  - Fluidité TV         → vidéos décoratives figées
 *
 * Note compatibilité : pas de `?.` ni de syntaxe ES2020+, les WebViews Tizen
 * 3.x/4.x (Chromium 47/56) refusent de parser le fichier entier sinon.
 */

(function () {
  "use strict";

  // TizenBrew injecte ce script dans *chaque* contexte JavaScript créé, y
  // compris celui des iframes. Sur une page de film, le lecteur est une iframe :
  // le script s'y exécutait aussi et y dessinait un second curseur. On ne garde
  // que la fenêtre principale.
  try {
    if (window.top !== window.self) return;
  } catch (e) {
    return; // accès refusé = on est dans une iframe d'un autre domaine
  }

  // ── CSS embarqué (source : inject.css) ────────────────────────────────────
  const STYLE_ID = "movix-tizenbrew-style";
  const CSS = `
/* Pas de curseur souris natif : on dessine le nôtre */
* { cursor: none !important; }

/* Scrollbars inutiles */
::-webkit-scrollbar { display: none; }

/* ── Curseur virtuel piloté par la télécommande ── */
#movix-tz-cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: 38px;
  height: 38px;
  /* Aligne la pointe de la flèche sur le point de clic réel, pas le coin de la
     boîte : la pointe du tracé SVG tombe à ~(8, 3) dans une boîte de 38 px. */
  margin: -3px 0 0 -8px;
  pointer-events: none;
  z-index: 2147483647;
  /* Pas de filter: drop-shadow ici. Un filtre se re-rastérise à chaque image,
     et sur une position fractionnaire il scintille — c'était l'origine du
     tremblement pendant les déplacements. Le contraste est obtenu par le
     contour noir du tracé SVG, qui ne coûte rien une fois rasterisé. */
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 2l14 9-6.2 1.4 3.4 6.4-3 1.6-3.4-6.5L5 19z' fill='%23ffffff' stroke='%23000000' stroke-width='2.2' stroke-linejoin='round'/></svg>") no-repeat center / contain;
}

/* Le curseur vire au rouge Movix au moment du clic */
#movix-tz-cursor.tz-click {
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 2l14 9-6.2 1.4 3.4 6.4-3 1.6-3.4-6.5L5 19z' fill='%23e50914' stroke='%23ffffff' stroke-width='2.2' stroke-linejoin='round'/></svg>") no-repeat center / contain;
}

/* ── Inputs agrandis pour clavier TV ── */
input[type="search"],
input[type="text"],
input[type="email"],
input[type="password"] {
  font-size: 20px !important;
  padding: 14px 18px !important;
  min-height: 52px !important;
}

/* ── Navbar : zones de clic plus grandes ── */
nav a, header a {
  padding: 12px 16px !important;
  min-height: 48px !important;
  display: inline-flex !important;
  align-items: center !important;
}

/* ── Boutons action plus facilement cliquables ── */
button, [role="button"] {
  min-height: 44px !important;
  min-width: 44px !important;
}

/* Le bandeau de raccourcis en bas à droite, hérité du projet d'origine, a été
   supprimé : il restait affiché en permanence, y compris par-dessus un film. */
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── Blocage pubs / popups / redirections ──────────────────────────────────
  //
  // Passer ADBLOCK à false si la lecture vidéo casse : c'est le seul réglage
  // à toucher pour tout désactiver d'un coup.
  //
  // Ce qui est bloqué :
  //  - iframes tierces     → sandbox sans allow-top-navigation : elles peuvent
  //                          ouvrir un onglet, jamais remplacer le nôtre
  //  - pixels de tracking  → iframes minuscules greffées sur <body>
  //  - pièges à clic       → overlays plein écran sans contenu utilisable,
  //                          sauf ceux posés sur le lecteur (ce sont eux qui
  //                          déclenchent la pub dont il a besoin)
  //  - liens tiers cliqués → annulés, on ne quitte pas Movix par mégarde
  //
  // Ce qui n'est PAS bloqué, volontairement : window.open. Voir handleAdTab().
  // Réactivé : le blocage n'était pas la cause du Play inerte. La cause était
  // window.open renvoyant null, désormais remplacé par un leurre (voir
  // defuseWindowOpen), qui est actif indépendamment de ce réglage.
  const ADBLOCK = true;

  // Sans "allow-popups" ni "allow-top-navigation", volontairement.
  //
  // Le leurre de window.open ne protège que la fenêtre principale : le code
  // d'une iframe tierce a son propre window.open, hors de notre portée. Sans
  // ce bac à sable, un lecteur embarqué pourrait donc ouvrir un vrai onglet et
  // piéger l'utilisateur — situation dont on ne peut plus sortir sur une TV.
  //
  // Le compromis est assumé : un lecteur qui exige d'ouvrir sa pub restera
  // peut-être muet, mais on ne se retrouvera jamais bloqué. Essayer un autre
  // lecteur dans la liste des sources coûte moins cher que redémarrer l'app.
  const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

  function sameSite(url) {
    try {
      const h = new URL(url, location.href).hostname;
      return h === location.hostname || h.endsWith("." + location.hostname);
    } catch (e) {
      return true; // href relatif ou illisible : on considère que c'est le site
    }
  }

  function hardenIframe(f) {
    if (f.getAttribute("data-tz-sandboxed")) return;
    f.setAttribute("data-tz-sandboxed", "1");
    const src = f.getAttribute("src");
    if (!src || sameSite(src)) return; // lecteur maison : on n'y touche pas
    f.setAttribute("sandbox", IFRAME_SANDBOX);
    // Sans cet attribut, requestFullscreen() sur l'iframe est refusé — et c'est
    // notre seul moyen de passer un lecteur embarqué en plein écran.
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("src", src);        // recharge sous sandbox
  }

  // Overlay plein écran, au-dessus de tout, sans contenu utile = piège à clic.
  function isClickTrap(el) {
    if (el.id === CURSOR_ID) return false; // notre curseur
    const s = window.getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "absolute") return false;
    if (s.pointerEvents === "none") return false;
    const z = parseInt(s.zIndex, 10);
    if (!(z >= 1000)) return false;

    const r = el.getBoundingClientRect();
    const viewport = (window.innerWidth || 1) * (window.innerHeight || 1);
    if ((r.width * r.height) / viewport < 0.6) return false;

    // Un overlay légitime de Movix contient quelque chose d'utilisable.
    if (el.querySelector("video, button, input, textarea, a[href^='/']")) return false;

    // Un overlay posé sur le lecteur n'est pas forcément un voleur de clic :
    // c'est souvent le déclencheur de pub dont le lecteur a besoin pour
    // démarrer. Le supprimer rendait le bouton Play définitivement inerte.
    const lecteur = getVideo() || biggestIframe();
    if (lecteur) {
      const lr = lecteur.getBoundingClientRect();
      const chevauche = Math.max(0, Math.min(r.right, lr.right) - Math.max(r.left, lr.left)) *
                        Math.max(0, Math.min(r.bottom, lr.bottom) - Math.max(r.top, lr.top));
      if (chevauche > lr.width * lr.height * 0.5) return false;
    }

    return el.textContent.trim().length < 5;
  }

  // Le balayage des pièges à clic inspecte le style calculé de dizaines
  // d'éléments : on ne le relance que si le DOM a effectivement bougé.
  let adDirty = true;

  function sweepAds() {
    // Iframes : après le layout, on sait lesquelles sont réellement invisibles.
    const frames = document.querySelectorAll("iframe");
    for (const f of frames) {
      const r = f.getBoundingClientRect();
      const s = window.getComputedStyle(f);
      const hidden = s.display === "none" || s.visibility === "hidden" || s.opacity === "0";
      const tiny = hidden || r.width < 50 || r.height < 50;

      // On ne supprime que les iframes minuscules greffées directement sur
      // <body> : c'est la signature des pixels de tracking (celui de Movix est
      // un 1×1 sans src, enfant direct de body). Un lecteur vidéo embarqué vit
      // à l'intérieur de la mise en page et peut mesurer 0×0 le temps de se
      // charger — le supprimer sur sa taille serait fatal à la lecture.
      if (f.getAttribute("data-tz-decoy")) continue; // notre leurre de window.open
      if (tiny && f.parentElement === document.body) { f.remove(); continue; }
      hardenIframe(f);
    }

    // Pièges à clic : ils sont réinjectés en boucle, d'où le balayage répété.
    if (!adDirty) return;
    adDirty = false;

    // La suppression des grands liens tiers posés sur le lecteur, ajoutée en
    // v5.6, a été retirée : c'est précisément cet élément qui déclenche
    // l'ouverture de la pub, sans laquelle le lecteur ne démarre jamais. On le
    // laisse faire son travail, la fenêtre qu'il ouvre est refermée aussitôt.
    const candidates = document.querySelectorAll("body > *, body > * > *");
    for (const el of candidates) {
      if (isClickTrap(el)) el.remove();
    }
  }

  // Exception au blocage des domaines tiers : les parcours de connexion passent
  // forcément par un fournisseur externe, et parfois par window.open. Les
  // bloquer rendrait impossible toute connexion au compte Movix.
  const AUTH_HOSTS = /(^|\.)(accounts\.google\.com|appleid\.apple\.com|login\.(microsoftonline|live)\.com|github\.com|.*\.auth0\.com|facebook\.com|discord\.com)$/i;

  function isAuthURL(url) {
    try {
      const u = new URL(url, location.href);
      return AUTH_HOSTS.test(u.hostname) || /(^|\/)(oauth|o\/oauth2|signin|sso|auth)(\/|$)/i.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  // Un clic vers un domaine tiers ne mène nulle part d'utile sur une TV.
  function onClickCapture(e) {
    const t = e.target;
    const a = t && t.closest ? t.closest("a[href]") : null;
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
    if (!sameSite(href) && !isAuthURL(href)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function initAdBlock() {
    if (!ADBLOCK) return;

    // Règle d'un bloqueur de popups classique : ce que l'utilisateur déclenche
    // lui-même passe, le reste est bloqué.
    //
    // Indispensable ici : la page de lecture de Movix conditionne le
    // démarrage du film à un bouton « Voir une publicité » qui ouvre une
    // fenêtre. En neutralisant window.open sans exception, aucun film ne
    // pouvait démarrer. Les popunders, eux, partent d'un minuteur ou d'un
    // événement de fond, sans activation utilisateur récente : ils restent
    // bloqués.
    // Une seule popup autorisée par chargement de page. Movix en a besoin
    // d'exactement une, pour son bouton « Voir une publicité ». Les suivantes
    // sont des pubs masquées : c'est l'une d'elles, posée sur le lecteur, qui a
    // détourné un appui sur Play vers un autre site.
    // window.open n'est plus touché du tout.
    //
    // Toutes les variantes essayées — renvoyer null, limiter à une popup,
    // refermer la fenêtre depuis l'ouvreur — ont fini par rendre le bouton
    // Play inerte. Les lecteurs embarqués vérifient leur fenêtre publicitaire
    // avant de lancer la lecture, et la moindre interférence les fait
    // abandonner en silence. Une version antérieure, qui ne touchait à rien,
    // lançait les films.
    //
    // La pub est donc traitée à l'arrivée et non au départ : c'est l'onglet
    // publicitaire lui-même qui se referme, dans handleAdTab() plus bas.
    // Le lecteur ne voit aucune différence avec un navigateur ordinaire.
    document.addEventListener("click", onClickCapture, true);

    // Ce callback se déclenche à chaque rendu React : il doit rester trivial.
    // Appeler querySelectorAll sur chaque nœud ajouté plombait l'interface.
    // On se contente de lever un drapeau que le balayage périodique consomme.
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.tagName === "IFRAME") hardenIframe(n);
          else adDirty = true;
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    sweepAds();
    setInterval(sweepAds, 2500);
  }

  // ── Vidéos décoratives ────────────────────────────────────────────────────
  //
  // La page d'accueil de Movix décore ses cartes avec huit MP4 en boucle
  // (logos Netflix, Disney+, Apple TV… servis par giphy et tenor). Sur un PC
  // ça ne se voit pas, sur le CPU d'une TV huit boucles vidéo en fond suffisent
  // à saccader toute l'interface. On les fige partout sauf dans le lecteur.
  const PAUSE_DECOR_VIDEOS = true;

  // Ne touche que les <video loop> : le lecteur ne boucle jamais, il est donc
  // hors d'atteinte par construction, sans avoir à deviner la page courante.
  function freezeDecorVideos() {
    if (!PAUSE_DECOR_VIDEOS) return;
    for (const v of document.querySelectorAll("video[loop]")) {
      v.removeAttribute("autoplay");
      v.preload = "none";
      if (!v.paused) v.pause();
    }
  }

  // Elles démarrent au survol : on les rattrape à la source plutôt que
  // d'attendre le prochain passage du minuteur.
  function onPlayCapture(e) {
    const v = e.target;
    if (!PAUSE_DECOR_VIDEOS) return;
    if (v && v.tagName === "VIDEO" && v.loop) v.pause();
  }

  // ── Keycodes Samsung Tizen ─────────────────────────────────────────────────
  const KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    ENTER: 13,
    BACK: 10009, RETURN: 10182,
    PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19,
    FF: 417, RW: 412, STOP: 413,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    SPACE: 32,
  };

  // ── Curseur virtuel ────────────────────────────────────────────────────────
  //
  // Vitesses en pixels par seconde, pas par image : le taux de rafraîchissement
  // d'une TV n'est pas garanti à 60 Hz, un déplacement par image serait deux
  // fois plus lent sur un panneau qui tombe à 30.
  const CURSOR_ID   = "movix-tz-cursor";
  const SPEED_MIN   = 450;   // départ lent, pour viser précisément
  const SPEED_MAX   = 1300;  // maintenu, on traverse l'écran en ~1,3 s
  const ACCEL       = 2.2;   // facteur d'accélération par seconde

  // Déplacement maximal autorisé en un seul tick, en pixels.
  //
  // C'est le correctif des « grands bonds ». Le pas vaut vitesse × temps
  // écoulé ; quand la TV n'arrive pas à tenir le rythme, les ticks se
  // décalent, le temps écoulé grimpe, et le curseur se téléporte de plus de
  // 100 px d'un coup — puis se fait rattraper par la limite de l'écran. Ce
  // va-et-vient est précisément ce qui donnait l'impression d'un tremblement
  // pendant le défilement. Plafonner le pas fait qu'un ralentissement de la TV
  // ralentit le curseur au lieu de le faire sauter.
  const MAX_STEP    = 26;
  const MAX_DT      = 0.033; // s — au-delà, on considère que la TV a décroché
  const ROW_RECHECK  = 200;   // ms entre deux recherches de rangée sous le curseur
  const KEY_TIMEOUT  = 260;   // sans nouvel appui, la touche est jugée relâchée
  const HOVER_MS     = 120;   // fréquence des mousemove de synthèse

  let lastScrollAt = 0;

  let cursorEl = null;
  let cx = 0, cy = 0;
  let speed = SPEED_MIN;
  let loopId = null;
  let lastTick = 0;
  let lastHover = 0;
  let rowTarget = null;
  let rowCheckedAt = 0;
  const held = { left: 0, right: 0, up: 0, down: 0 };

  function ensureCursor() {
    if (!document.body) return;

    if (!cursorEl || !document.contains(cursorEl)) {
      cursorEl = document.getElementById(CURSOR_ID);
      if (!cursorEl) {
        cursorEl = document.createElement("div");
        cursorEl.id = CURSOR_ID;
        document.body.appendChild(cursorEl);
        cx = (window.innerWidth || 1280) / 2;
        cy = (window.innerHeight || 720) / 2;
      }
      paintCursor();
      return;
    }

    // Le curseur doit rester le dernier enfant de <body>. Movix monte ses
    // fenêtres modales — connexion, phrase secrète, écran publicitaire — dans
    // un conteneur ajouté après coup, et un élément ajouté plus tard peut se
    // peindre par-dessus. Le remettre en dernier garantit qu'il reste visible.
    if (document.body.lastElementChild !== cursorEl) {
      document.body.appendChild(cursorEl);
    }
  }

  let paintedX = null, paintedY = null;

  function paintCursor() {
    if (!cursorEl) return;
    // translate3d plutôt que top/left : aucun recalcul de mise en page, et une
    // couche GPU stable. Les coordonnées sont arrondies au pixel : les laisser
    // fractionnaires faisait vibrer la flèche, rerastérisée à chaque image sur
    // un décalage sous-pixel différent.
    const x = Math.round(cx), y = Math.round(cy);
    // Rien à redessiner si le pixel n'a pas changé. Le cas est fréquent : le
    // curseur reste immobile pendant tout un défilement de bord.
    if (x === paintedX && y === paintedY) return;
    paintedX = x;
    paintedY = y;
    cursorEl.style.transform = "translate3d(" + x + "px," + y + "px,0)";
  }

  // elementFromPoint renvoie le curseur lui-même s'il n'est pas transparent aux
  // clics ; le CSS le met en pointer-events:none, ceci n'est qu'une ceinture.
  function elementUnderCursor() {
    const el = document.elementFromPoint(cx, cy);
    if (el && el.id === CURSOR_ID) return null;
    return el;
  }

  function mouseEventInit() {
    return { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
  }

  // La page compte 257 éléments avec une transition CSS et des classes hover:.
  // La v4.1 envoyait un mouseover toutes les 120 ms sans jamais envoyer le
  // mouseout correspondant : les états de survol s'accumulaient sans jamais se
  // libérer, et pendant un défilement chaque élément qui passait sous le
  // curseur déclenchait une animation de plus. C'était ça, le tremblement.
  let hoverEl = null;

  function sendHover() {
    const el = elementUnderCursor();
    if (el === hoverEl) return; // rien de neuf : ne relance aucune transition

    const previous = hoverEl;
    hoverEl = el;

    if (previous && document.contains(previous)) {
      const out = mouseEventInit();
      out.relatedTarget = el;
      previous.dispatchEvent(new MouseEvent("mouseout", out));
      const leave = mouseEventInit();
      leave.bubbles = false;
      leave.relatedTarget = el;
      previous.dispatchEvent(new MouseEvent("mouseleave", leave));
    }

    if (!el) return;
    const over = mouseEventInit();
    over.relatedTarget = previous;
    el.dispatchEvent(new MouseEvent("mouseover", over));
    el.dispatchEvent(new MouseEvent("mousemove", mouseEventInit()));
  }

  function clickUnderCursor() {
    const el = elementUnderCursor();
    if (!el) return;


    const o = mouseEventInit();

    // Les overlays publicitaires posés sur les lecteurs écoutent souvent
    // pointerdown ou touchstart plutôt que click : n'envoyer que la séquence
    // souris laissait leur déclencheur sans rien entendre. On émet donc les
    // deux familles, dans l'ordre d'un vrai navigateur.
    if (typeof window.PointerEvent === "function") {
      const p = mouseEventInit();
      p.pointerId = 1;
      p.pointerType = "mouse";
      p.isPrimary = true;
      el.dispatchEvent(new PointerEvent("pointerover", p));
      el.dispatchEvent(new PointerEvent("pointerdown", p));
      el.dispatchEvent(new PointerEvent("pointerup", p));
    }

    el.dispatchEvent(new MouseEvent("mouseover", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus();
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));

    flashCursor();
  }

  // Retour visuel : le curseur vire au rouge le temps d'un clic.
  function flashCursor() {
    if (!cursorEl) return;
    cursorEl.classList.add("tz-click");
    setTimeout(() => { if (cursorEl) cursorEl.classList.remove("tz-click"); }, 150);
  }

  // ── Défilement ─────────────────────────────────────────────────────────────
  //
  // Toujours en pixels entiers. Envoyer des valeurs sous-pixel à scrollBy
  // soixante fois par seconde faisait trembler la page ; on accumule les
  // fractions et on ne défile que par pas entiers.

  // Défilement par paliers, plus en continu.
  //
  // C'est le « mode scroll » : arrivé contre un bord, chaque palier est un saut
  // net, puis plus rien jusqu'au suivant. Le défilement continu obligeait la TV
  // à redessiner la page sans interruption pendant tout un maintien de flèche —
  // trente fois par seconde même après optimisation — et c'est ce qui restait
  // saccadé. Un palier, c'est deux ou trois images à dessiner au lieu de trente.
  //
  // SCROLL_STEP_RATIO : hauteur d'un palier, en fraction d'écran.
  // SCROLL_STEP_MS    : cadence des paliers tant que la flèche est maintenue.
  // Augmenter le premier saute plus loin, augmenter le second ralentit.
  const SCROLL_STEP_RATIO = 0.4;
  const SCROLL_STEP_MS    = 260;

  function scrollPageStep(dir, now) {
    if (now - lastScrollAt < SCROLL_STEP_MS) return;
    lastScrollAt = now;
    const delta = dir * Math.round((window.innerHeight || 720) * SCROLL_STEP_RATIO);

    // Movix charge Lenis (défilement fluide). On pourrait croire qu'il faut
    // passer par son API pour ne pas se battre avec sa boucle d'animation.
    // C'est faux, et c'est mesuré : sur movix.fun avec Lenis actif, un
    // scrollBy natif s'applique et tient (0 → 288 → 288 px après 400 ms),
    // tandis que lenis.scrollTo() ne déplace rien du tout. On reste au natif.
    window.scrollBy(0, delta);
  }

  function scrollRowStep(el, dir, now) {
    if (now - lastScrollAt < SCROLL_STEP_MS) return;
    lastScrollAt = now;
    el.scrollLeft += dir * Math.round((el.clientWidth || 600) * SCROLL_STEP_RATIO);
  }

  function canScrollPage(dir) {
    if (dir < 0) return window.pageYOffset > 0;
    const de = document.documentElement;
    return window.pageYOffset + window.innerHeight < de.scrollHeight - 1;
  }

  // Les rangées de films sont des carrousels à défilement horizontal (Embla).
  // Sans ça on ne voit que les premières cartes de chaque rangée : sur la page
  // d'accueil, 1118 px visibles pour 8944 px de contenu. Leur overflow-x vaut
  // "hidden", mais scrollLeft reste pilotable — vérifié sur movix.fun.
  function findRowUnderCursor() {
    let el = elementUnderCursor();
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollWidth > el.clientWidth + 4) {
        // Le test de largeur ne suffit pas : chez Embla, le conteneur intérieur
        // annonce lui aussi 1118/8944 mais son overflow-x est "visible", donc
        // son scrollLeft reste bloqué à 0. Seul le viewport défile vraiment.
        const ox = window.getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function canScrollRow(el, dir) {
    if (!el || !document.contains(el)) return false;
    return dir < 0
      ? el.scrollLeft > 0
      : el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
  }

  function moveCursorTo(el) {
    const r = el.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    paintCursor();
  }

  function tick() {
    const now = Date.now();
    const dt = Math.min(MAX_DT, (now - lastTick) / 1000);
    lastTick = now;

    let dx = 0, dy = 0;
    if (now - held.left  < KEY_TIMEOUT) dx -= 1;
    if (now - held.right < KEY_TIMEOUT) dx += 1;
    if (now - held.up    < KEY_TIMEOUT) dy -= 1;
    if (now - held.down  < KEY_TIMEOUT) dy += 1;

    if (dx === 0 && dy === 0) {
      speed = SPEED_MIN;
      rowTarget = null;
      clearInterval(loopId);
      loopId = null;
      sendHover(); // survol final, pour les aperçus au repos
      return;
    }

    speed = Math.min(SPEED_MAX, speed * (1 + ACCEL * dt));
    const step = Math.min(MAX_STEP, speed * dt);
    const vw = window.innerWidth  || 1280;
    const vh = window.innerHeight || 720;

    cx += dx * step;
    cy += dy * step;

    // Le défilement ne se déclenche que lorsque le curseur est *réellement*
    // collé au bord de l'écran. Avec une marge de 70 px, tout ce qui se
    // trouvait dans cette bande — la barre de navigation en premier — défilait
    // sous le curseur sans qu'on puisse s'y arrêter pour cliquer.
    const hitLeft   = cx <= 0;
    const hitRight  = cx >= vw - 1;
    const hitTop    = cy <= 0;
    const hitBottom = cy >= vh - 1;

    if (cx < 0) cx = 0;
    if (cx > vw - 1) cx = vw - 1;
    if (cy < 0) cy = 0;
    if (cy > vh - 1) cy = vh - 1;

    let scrolled = false;

    if (dy < 0 && hitTop    && canScrollPage(-1)) { scrollPageStep(-1, now); scrolled = true; }
    if (dy > 0 && hitBottom && canScrollPage(1))  { scrollPageStep(1, now);  scrolled = true; }

    // Même principe à l'horizontale, sur la rangée de films sous le curseur.
    if (dx !== 0 && (dx < 0 ? hitLeft : hitRight)) {
      if (now - rowCheckedAt > ROW_RECHECK) {
        rowCheckedAt = now;
        rowTarget = findRowUnderCursor();
      }
      if (canScrollRow(rowTarget, dx)) {
        scrollRowStep(rowTarget, dx, now);
        scrolled = true;
      }
    }

    paintCursor();

    // Pas de survol pendant un défilement : le curseur ne bouge pas à l'écran,
    // c'est le contenu qui glisse dessous, et relancer une transition par
    // élément traversé n'apporte rien tout en chargeant le CPU de la TV.
    if (!scrolled && now - lastHover > HOVER_MS) { lastHover = now; sendHover(); }
  }

  function startCursorLoop() {
    if (loopId) return;
    lastTick = Date.now();
    // setInterval plutôt que requestAnimationFrame : rAF est suspendu dès que
    // la WebView ne se juge pas visible, et un curseur figé rend la
    // télécommande inutilisable. La boucle s'arrête d'elle-même dès qu'aucune
    // flèche n'est maintenue, donc rien ne tourne au repos. Les déplacements
    // sont calculés en px/seconde, ils restent identiques quel que soit le
    // taux de rafraîchissement réel de la TV.
    loopId = setInterval(tick, 16);
  }

  // ── Player : manipulation directe de la balise <video> ────────────────────
  //
  // Directement dans le DOM, pas dans un shadow DOM ni iframe. Beaucoup plus
  // fiable que de cliquer sur des boutons aux classes Tailwind instables.

  // Le lecteur, c'est la plus grande <video> non décorative de la page.
  // querySelector("video") tombait sur les vignettes animées de l'accueil.
  function getVideo() {
    let best = null, bestArea = 0;
    for (const v of document.querySelectorAll("video")) {
      if (v.loop) continue; // boucles décoratives, jamais le lecteur
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = v; }
    }
    return best;
  }

  // Plein écran sur la vidéo si on y a accès, sinon sur l'iframe qui la
  // contient — un lecteur embarqué est cross-origin, sa <video> est hors de
  // portée, mais l'iframe elle-même est bien dans notre document.
  function biggestIframe() {
    let best = null, bestArea = 0;
    for (const f of document.querySelectorAll("iframe")) {
      const r = f.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = f; }
    }
    return bestArea > 40000 ? best : null;
  }

  function toggleFullscreen() {
    const d = document;
    const exit = d.exitFullscreen || d.webkitExitFullscreen || d.mozCancelFullScreen;
    if (d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement) {
      if (exit) { exit.call(d); return true; }
      return false;
    }
    const target = getVideo() || biggestIframe() || d.documentElement;
    const req = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen;
    if (!req) return false;
    try { req.call(target); } catch (e) { return false; }
    return true;
  }

  // Repli quand il n'y a pas de <video> à notre portée : on cherche le bouton
  // de lecture dans la page et on le clique. C'est ce qui rend la touche ▶ de
  // la télécommande utilisable là où une pub masquée intercepte le clic du
  // curseur — la touche, elle, ne passe pas par la position à l'écran.
  const PLAY_LABELS = ["regarder", "lecture", "lire", "play", "démarrer", "demarrer"];

  function pressPlayButton() {
    const candidats = document.querySelectorAll("button, [role='button'], a[href]");
    for (const b of candidats) {
      const texte = ((b.textContent || "") + " " +
                     (b.getAttribute("aria-label") || "") + " " +
                     (b.getAttribute("title") || "")).toLowerCase();
      if (!PLAY_LABELS.some(l => texte.includes(l))) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      b.click();
      return true;
    }
    return false;
  }

  function togglePlayPause() {
    const v = getVideo();
    if (!v) return pressPlayButton();
    if (v.paused) v.play();
    else          v.pause();
    return true;
  }

  function seek(sec) {
    const v = getVideo();
    if (!v) return false;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + sec));
    return true;
  }

  function handlePlayerKeys(kc) {
    switch (kc) {
      case KEY.SPACE:
      case KEY.PLAY_PAUSE:
        return togglePlayPause();

      case KEY.PLAY: {
        const v = getVideo();
        if (v) { v.play(); return true; }
        return pressPlayButton(); // même repli que ⏯
      }

      case KEY.PAUSE: {
        const v = getVideo();
        if (v) { v.pause(); return true; }
        return false;
      }

      case KEY.RIGHT:
      case KEY.FF:
        return seek(+10);

      case KEY.LEFT:
      case KEY.RW:
        return seek(-10);

      case KEY.UP: {
        const v = getVideo();
        if (v) { v.volume = Math.min(1, v.volume + 0.1); return true; }
        return false;
      }

      case KEY.DOWN: {
        const v = getVideo();
        if (v) { v.volume = Math.max(0, v.volume - 0.1); return true; }
        return false;
      }

      case KEY.STOP: {
        const v = getVideo();
        if (v) { v.pause(); v.currentTime = 0; return true; }
        return false;
      }

    }
    return false;
  }

  // ── Raccourcis touches couleurs ────────────────────────────────────────────

  function handleColorKeys(kc) {
    switch (kc) {
      case KEY.RED: {
        const inp = document.querySelector("input[type='search'], input[placeholder*='film'], input[placeholder*='Rechercher']");
        if (inp) { moveCursorTo(inp); inp.focus(); return true; }
        const sl = document.querySelector("a[href*='search'], a[href*='recherche']");
        if (sl) { moveCursorTo(sl); sl.click(); return true; }
        return false;
      }

      case KEY.GREEN: {
        const hl = document.querySelector("a[href='/'], [class*='logo'] a, .logo a");
        if (hl) { hl.click(); return true; }
        return false;
      }

      case KEY.YELLOW: {
        const btns = Array.from(document.querySelectorAll("button"));
        const aVoir = btns.find(b => b.textContent.trim().includes("À voir") || b.textContent.trim().includes("voir"));
        if (aVoir) { moveCursorTo(aVoir); aVoir.click(); return true; }
        return false;
      }

      // Le lecteur de Movix n'offre pas de bouton plein écran utilisable à la
      // télécommande, et ses commandes restent donc affichées par-dessus le
      // film. La touche bleue bascule le plein écran sur la vidéo elle-même.
      case KEY.BLUE:
        return toggleFullscreen();
    }
    return false;
  }

  // ── Retour : toujours une issue ────────────────────────────────────────────
  //
  // Une pub peut emmener le navigateur hors de Movix, sur une page dont on ne
  // revient pas : l'entrée d'historique est parfois remplacée, et history.back()
  // n'a alors nulle part où aller. Sur une TV, l'utilisateur est bloqué.
  //
  // TizenBrew réinjecte ce script dans chaque nouveau contexte, quel que soit le
  // domaine : Retour reste donc opérant sur la page publicitaire, et peut nous
  // ramener de force.
  const HOME = "https://movix.fun/";
  const BACK_FALLBACK_MS = 700;

  function onMovix() {
    const h = location.hostname;
    return h === "movix.fun" || h.endsWith(".movix.fun");
  }

  function goBack() {
    if (!onMovix()) {          // une pub nous a fait sortir : on rentre
      location.href = HOME;
      return true;
    }
    // Sans historique, on laisse passer : c'est ce qui permet de quitter le
    // module et de revenir au launcher TizenBrew.
    if (window.history.length <= 1) return false;

    const before = location.href;
    window.history.back();
    // history.back() est asynchrone et peut ne rien faire. Si rien n'a bougé,
    // on rentre à l'accueil : ce n'est jamais un cul-de-sac.
    setTimeout(function () {
      if (location.href === before) location.href = HOME;
    }, BACK_FALLBACK_MS);
    return true;
  }

  // ── Handler principal ──────────────────────────────────────────────────────

  function onKeyDown(e) {
    const kc = e.keyCode;

    // Les touches médias pilotent la vidéo, toujours et partout. Elles sont
    // dédiées à ça sur une télécommande Samsung et ne gênent jamais le curseur.
    if ([KEY.PLAY_PAUSE, KEY.PLAY, KEY.PAUSE, KEY.FF, KEY.RW, KEY.STOP].includes(kc)) {
      if (handlePlayerKeys(kc)) { e.preventDefault(); return; }
    }

    // Il n'existe plus de "mode lecteur" qui confisquerait les flèches.
    //
    // C'était la cause du blocage complet : dès qu'une vidéo était détectée,
    // toutes les touches partaient au lecteur et le gestionnaire sortait
    // immédiatement, curseur masqué. Si la vidéo se relançait toute seule ou si
    // OK n'arrivait pas à la mettre en pause, plus rien ne répondait et il
    // fallait tuer l'application.
    //
    // La règle appliquée est celle de la Magic Remote de LG, qui fait
    // référence : une flèche ramène toujours le pointeur. Le curseur reste donc
    // utilisable en permanence, y compris par-dessus une vidéo en lecture —
    // ce qui permet de cliquer les commandes du lecteur de Movix. Pour avancer
    // ou reculer, les touches ⏩ ⏪ ci-dessus.

    if ([KEY.RED, KEY.GREEN, KEY.YELLOW, KEY.BLUE].includes(kc)) {
      if (handleColorKeys(kc)) { e.preventDefault(); return; }
    }

    const now = Date.now();

    // Aucune exception, y compris quand un champ de saisie a le focus. La
    // saisie de texte passe par le clavier virtuel de Tizen, qui intercepte les
    // touches avant la page ; rendre les flèches au champ ne servait donc à
    // rien et privait l'utilisateur du curseur en pleine connexion.
    switch (kc) {
      case KEY.LEFT:  held.left  = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.RIGHT: held.right = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.UP:    held.up    = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.DOWN:  held.down  = now; startCursorLoop(); e.preventDefault(); break;

      case KEY.ENTER:
      case KEY.SPACE:
        clickUnderCursor();
        e.preventDefault();
        break;

      case KEY.BACK:
      case KEY.RETURN:
        if (goBack()) e.preventDefault();
        break;
    }
  }

  function onKeyUp(e) {
    switch (e.keyCode) {
      case KEY.LEFT:  held.left  = 0; break;
      case KEY.RIGHT: held.right = 0; break;
      case KEY.UP:    held.up    = 0; break;
      case KEY.DOWN:  held.down  = 0; break;
    }
  }

  // ── Entretien périodique ───────────────────────────────────────────────────
  // Un seul minuteur : React peut remplacer le <body>, et la page peut passer
  // dans le lecteur où le curseur n'a rien à faire.

  // Le curseur n'est jamais masqué, jamais estompé, jamais désactivé. Chaque
  // tentative d'être malin là-dessus — masquage dans le lecteur, effacement
  // après inactivité — a fini par laisser l'utilisateur sans pointeur.
  //
  // Le focus est aussi ramené au document principal : s'il part dans une iframe
  // tierce, notre écouteur de touches ne reçoit plus rien du tout. Le lecteur
  // embarqué se met alors à interpréter les flèches lui-même — il monte le son
  // ou avance dans le film — pendant que le curseur paraît mort.
  function housekeeping() {
    ensureCursor();
    const ae = document.activeElement;
    if (ae && ae.tagName === "IFRAME") ae.blur();
    freezeDecorVideos();
  }

  // ── Enregistrement touches Tizen ──────────────────────────────────────────
  // Redondant avec le champ "keys" du package.json (TizenBrew les enregistre
  // déjà), gardé comme filet de sécurité. Sans effet hors TV.

  function registerKeys() {
    try {
      if (window.tizen && window.tizen.inputdevice) {
        ["ColorF0Red","ColorF1Green","ColorF2Yellow","ColorF3Blue",
         "MediaPlay","MediaPause","MediaStop","MediaFastForward","MediaRewind","MediaPlayPause"]
        .forEach(k => { try { window.tizen.inputdevice.registerKey(k); } catch(e){} });
      }
    } catch(e) {}
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  let initialized = false;

  // Certaines pubs ne passent pas par une popup mais emportent la page entière.
  // TizenBrew injecte ce script sur la page publicitaire aussi : on y détecte
  // qu'on n'est plus sur Movix et on revient tout seul, sans rien demander.
  // Les domaines d'authentification sont exclus, sinon on couperait une
  // connexion en cours.
  const AD_RETURN_MS = 2500;

  // Ce script s'exécute aussi sur l'onglet publicitaire, puisque TizenBrew
  // l'injecte dans chaque contexte. On traite donc la pub depuis l'intérieur,
  // sans jamais gêner le lecteur qui l'a ouverte.
  //
  //  - onglet ouvert par une autre fenêtre → il se referme lui-même. Une
  //    fenêtre ouverte par script a le droit de s'auto-fermer, donc ça marche
  //    même vers un autre domaine, et la page du film redevient visible.
  //  - page arrivée sans ouvreur, c'est-à-dire une redirection qui a remplacé
  //    le film → on revient en arrière.
  function handleAdTab() {
    if (onMovix() || isAuthURL(location.href)) return;

    const ouvertParUnAutreOnglet = !!window.opener;

    setTimeout(function () {
      if (onMovix() || isAuthURL(location.href)) return;

      if (ouvertParUnAutreOnglet) {
        try { window.close(); } catch (e) {}
        return;
      }
      const avant = location.href;
      window.history.back();
      setTimeout(function () {
        if (location.href === avant) location.href = HOME;
      }, BACK_FALLBACK_MS);
    }, AD_RETURN_MS);
  }

  // Durée de vie du leurre. Le lecteur vérifie parfois sa fenêtre plusieurs
  // secondes après l'avoir ouverte : on la garde disponible largement au-delà.
  const DECOY_LIFETIME_MS = 30000;

  // On n'empêche rien et on ne renvoie rien de faux : la fenêtre est réellement
  // ouverte, le lecteur peut la vérifier, la lecture démarre. On se contente de
  // reprendre le focus pour que la TV réaffiche le film, puis de refermer
  // l'onglet resté en arrière-plan.
  //
  // C'est indispensable ici : TizenBrew n'attache son débogueur qu'à une seule
  // cible, donc ce script ne s'exécute PAS dans le nouvel onglet. Rien ne peut
  // l'y refermer, et sans barre d'onglets une TV n'offre aucun retour. Ce
  // traitement doit donc se faire depuis la page qui a ouvert la fenêtre.
  //
  // Actif même quand ADBLOCK vaut false : ce n'est pas du blocage, c'est ce qui
  // évite de rester coincé.
  // Leurre de fenêtre, repris de la technique de uBlock Origin
  // (scriptlet « window.open-defuser », alias « nowoif ») : on renvoie le
  // contentWindow d'une iframe cachée. C'est un véritable objet Window, donc
  // toutes les vérifications du script publicitaire passent — w non nul,
  // w.document accessible, w.focus() et w.close() existants — et le lecteur
  // enchaîne sur la lecture. Mais aucun onglet ne s'ouvre.
  //
  // C'est la seule issue viable ici. Renvoyer null rendait Play inerte, et
  // laisser l'onglet s'ouvrir piège l'utilisateur : la touche Retour n'y fait
  // rien, ce script ne s'y exécute pas, et une TV n'a pas de barre d'onglets.
  function decoyWindow() {
    const f = document.createElement("iframe");
    f.setAttribute("data-tz-decoy", "1");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;border:0";
    (document.body || document.documentElement).appendChild(f);
    // Assez long pour couvrir les vérifications différées du lecteur.
    setTimeout(function () { try { f.remove(); } catch (e) {} }, DECOY_LIFETIME_MS);
    return f.contentWindow;
  }

  function defuseWindowOpen() {
    const realOpen = window.open;
    window.open = function (url) {
      // La connexion doit vraiment s'ouvrir, elle.
      if (url && isAuthURL(url)) return realOpen.apply(window, arguments);
      return decoyWindow();
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    handleAdTab();
    defuseWindowOpen();
    injectStyle();
    initAdBlock();
    ensureCursor();
    document.addEventListener("play", onPlayCapture, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    setInterval(housekeeping, 400);
    registerKeys();
    console.log("[Movix TizenBrew v6.3] curseur actif");
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

})();
