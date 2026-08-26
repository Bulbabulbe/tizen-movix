/**
 * Movix TizenBrew — inject.js v5.0
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
 *  - Bord haut/bas       → fait défiler, une fois le curseur collé au bord
 *  - Bord gauche/droite  → fait défiler la rangée de films sous le curseur
 *  - Haut/bas ou Retour  → quittent le champ de recherche
 *  - OK                  → clic à la position du curseur
 *  - Retour              → page précédente
 *  - Touches médias      → contrôlent la vidéo, toujours et partout
 *  - Touches couleurs    → raccourcis Recherche / Accueil / À voir / Favoris
 *  - Anti-pub            → popunders, iframes tierces, pièges à clic (ADBLOCK).
 *                          Les popups que TU déclenches passent : Movix
 *                          conditionne la lecture à un bouton publicitaire.
 *  - Fluidité TV         → vidéos décoratives figées
 *
 * Note compatibilité : pas de `?.` ni de syntaxe ES2020+, les WebViews Tizen
 * 3.x/4.x (Chromium 47/56) refusent de parser le fichier entier sinon.
 */

(function () {
  "use strict";

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
  opacity: 1;
  /* Fondu d'effacement après quelques secondes d'inactivité. Une transition
     d'opacité seule reste une opération de composition, sans repaint. */
  transition: opacity 0.25s linear;
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

/* ── Indication raccourcis couleurs (coin bas droit) ── */
body::after {
  content: "🔴 Recherche  🟢 Accueil  🟡 À voir  🔵 Favoris";
  position: fixed;
  bottom: 12px;
  right: 16px;
  color: rgba(255,255,255,0.45);
  font-size: 13px;
  font-family: Arial, sans-serif;
  pointer-events: none;
  z-index: 99999;
  background: rgba(0,0,0,0.5);
  padding: 5px 10px;
  border-radius: 6px;
}

/* Cache l'indicateur dans le player (plein écran) */
:-webkit-full-screen body::after,
:fullscreen body::after { display: none; }
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
  //  - popunders                    → window.open sans activation utilisateur
  //                                   récente ne renvoie rien
  //  - iframes tierces              → mises en sandbox sans allow-popups ni
  //                                   allow-top-navigation, ce qui coupe les
  //                                   popunders et les redirections forcées
  //                                   des lecteurs embarqués (inatteignables
  //                                   autrement, ils sont cross-origin)
  //  - pixels de tracking           → iframes minuscules greffées sur <body>
  //  - overlays transparents        → les "click traps" plein écran qui volent
  //                                   le clic OK de la télécommande
  //  - clics vers un domaine tiers  → annulés, on ne quitte jamais Movix
  //
  // Ce qui passe volontairement :
  //  - les popups déclenchées par un appui sur OK — Movix conditionne le
  //    démarrage d'un film à un bouton « Voir une publicité »
  //  - les domaines d'authentification (connexion au compte)
  const ADBLOCK = true;

  // Horodatage du dernier appui sur OK : sert à distinguer une popup voulue par
  // l'utilisateur d'un popunder ouvert en arrière-plan.
  let lastUserClick = 0;
  const USER_CLICK_WINDOW = 1200; // ms

  // Volontairement sans "allow-popups", "allow-top-navigation" ni
  // "allow-top-navigation-by-user-activation" : c'est là tout l'intérêt.
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
    f.setAttribute("src", src);        // recharge sous sandbox
  }

  // Overlay plein écran, au-dessus de tout, sans contenu utile = piège à clic.
  function isClickTrap(el) {
    if (el.id === CURSOR_ID) return false;
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
      if (tiny && f.parentElement === document.body) { f.remove(); continue; }
      hardenIframe(f);
    }

    // Pièges à clic : ils sont réinjectés en boucle, d'où le balayage répété.
    if (!adDirty) return;
    adDirty = false;
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
    const realOpen = window.open;
    window.open = function (url) {
      if (Date.now() - lastUserClick < USER_CLICK_WINDOW) return realOpen.apply(window, arguments);
      if (url && isAuthURL(url)) return realOpen.apply(window, arguments);
      return null;
    };
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
  const SPEED_MIN   = 520;   // départ lent, pour viser précisément
  const SPEED_MAX   = 2400;  // maintenu, on traverse l'écran en ~1 s
  const ACCEL       = 2.4;   // facteur d'accélération par seconde
  const SCROLL_SPEED = 1100;  // px/s — volontairement indépendant de la vitesse
                              // du curseur : indexer le défilement sur une
                              // vitesse qui accélère jusqu'à 2400 px/s faisait
                              // s'emballer la page.
  const ROW_RECHECK  = 200;   // ms entre deux recherches de rangée sous le curseur
  const KEY_TIMEOUT  = 260;   // sans nouvel appui, la touche est jugée relâchée
  const HOVER_MS     = 120;   // fréquence des mousemove de synthèse
  const IDLE_HIDE_MS = 3000;  // effacement du curseur après ce délai sans appui

  // Le défilement n'est appliqué qu'à 30 Hz, pas à chaque tick. Même vitesse
  // moyenne, mais deux fois moins d'opérations de défilement, chacune deux fois
  // plus grande. Sur le CPU d'une TV, soixante repaints par seconde était
  // au-dessus des moyens du panneau : c'est ce qui donnait ce défilement
  // heurté. Augmenter cette valeur (50, 66…) rend le défilement plus économe
  // mais plus saccadé.
  const SCROLL_INTERVAL = 33; // ms
  let lastScrollAt = 0;
  let lastActivity = 0;

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
    if (cursorEl && document.contains(cursorEl)) return;
    cursorEl = document.getElementById(CURSOR_ID);
    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.id = CURSOR_ID;
      document.body.appendChild(cursorEl);
      cx = (window.innerWidth || 1280) / 2;
      cy = (window.innerHeight || 720) / 2;
    }
    paintCursor();
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
    lastUserClick = Date.now(); // autorise la popup que ce clic pourrait ouvrir
    const o = mouseEventInit();
    el.dispatchEvent(new MouseEvent("mouseover", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus();
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));

    if (cursorEl) {
      cursorEl.classList.add("tz-click");
      setTimeout(() => { if (cursorEl) cursorEl.classList.remove("tz-click"); }, 150);
    }
  }

  // ── Défilement ─────────────────────────────────────────────────────────────
  //
  // Toujours en pixels entiers. Envoyer des valeurs sous-pixel à scrollBy
  // soixante fois par seconde faisait trembler la page ; on accumule les
  // fractions et on ne défile que par pas entiers.
  let accY = 0, accX = 0;

  function scrollDue(now) {
    return now - lastScrollAt >= SCROLL_INTERVAL;
  }

  function scrollPage(amount, now) {
    accY += amount;
    if (!scrollDue(now)) return;
    const whole = accY > 0 ? Math.floor(accY) : Math.ceil(accY);
    if (!whole) return;
    lastScrollAt = now;
    accY -= whole;
    window.scrollBy(0, whole);
  }

  function scrollRow(el, amount, now) {
    accX += amount;
    if (!scrollDue(now)) return;
    const whole = accX > 0 ? Math.floor(accX) : Math.ceil(accX);
    if (!whole) return;
    lastScrollAt = now;
    accX -= whole;
    el.scrollLeft += whole;
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
    const dt = Math.min(0.05, (now - lastTick) / 1000); // plafond anti-saut
    lastTick = now;

    let dx = 0, dy = 0;
    if (now - held.left  < KEY_TIMEOUT) dx -= 1;
    if (now - held.right < KEY_TIMEOUT) dx += 1;
    if (now - held.up    < KEY_TIMEOUT) dy -= 1;
    if (now - held.down  < KEY_TIMEOUT) dy += 1;

    if (dx === 0 && dy === 0) {
      speed = SPEED_MIN;
      accX = accY = 0;
      rowTarget = null;
      clearInterval(loopId);
      loopId = null;
      sendHover(); // survol final, pour les aperçus au repos
      return;
    }

    speed = Math.min(SPEED_MAX, speed * (1 + ACCEL * dt));
    const step = speed * dt;
    const scrollStep = SCROLL_SPEED * dt;
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

    if (dy < 0 && hitTop    && canScrollPage(-1)) { scrollPage(-scrollStep, now); scrolled = true; }
    if (dy > 0 && hitBottom && canScrollPage(1))  { scrollPage(scrollStep, now);  scrolled = true; }

    // Même principe à l'horizontale, sur la rangée de films sous le curseur.
    if (dx !== 0 && (dx < 0 ? hitLeft : hitRight)) {
      if (now - rowCheckedAt > ROW_RECHECK) {
        rowCheckedAt = now;
        rowTarget = findRowUnderCursor();
      }
      if (canScrollRow(rowTarget, dx)) {
        scrollRow(rowTarget, dx * scrollStep, now);
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

  // Vrai si l'utilisateur saisit du texte : on rend alors les flèches et Entrée
  // au champ, sinon la recherche est inutilisable.
  function isTyping() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = ae.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || ae.isContentEditable === true;
  }

  function leaveField() {
    const ae = document.activeElement;
    if (ae && ae.blur) ae.blur();
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

  function togglePlayPause() {
    const v = getVideo();
    if (!v) return false;
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

  // Bouton "← Retour" du player, repéré par son texte ou son icône.
  function clickRetour() {
    const btns = document.querySelectorAll("button");
    for (const b of btns) {
      if (b.textContent.trim().includes("Retour") || b.querySelector("path[d*='M10 19l-7-7']")) {
        b.click();
        return true;
      }
    }
    window.history.back();
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
        return false;
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

      case KEY.BACK:
      case KEY.RETURN:
        return clickRetour();

      case KEY.ENTER:
        return togglePlayPause();
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

      case KEY.BLUE: {
        const btns = Array.from(document.querySelectorAll("button"));
        const fav = btns.find(b => b.textContent.trim().includes("Favoris"));
        if (fav) { moveCursorTo(fav); fav.click(); return true; }
        return false;
      }
    }
    return false;
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

    const typing = isTyping();
    const now = Date.now();

    // Toute touche de navigation réveille le curseur s'il s'était effacé.
    if ([KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER, KEY.SPACE].includes(kc)) {
      showCursor();
    }

    switch (kc) {
      // Gauche/droite déplacent le curseur dans le texte pendant une saisie.
      case KEY.LEFT:  if (typing) break; held.left  = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.RIGHT: if (typing) break; held.right = now; startCursorLoop(); e.preventDefault(); break;

      // Haut et bas quittent le champ. C'est la porte de sortie du clavier :
      // sans elle, une fois le focus dans la recherche, plus aucune flèche ne
      // revenait au curseur et il fallait tuer l'application.
      case KEY.UP:    if (typing) leaveField(); held.up   = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.DOWN:  if (typing) leaveField(); held.down = now; startCursorLoop(); e.preventDefault(); break;

      case KEY.ENTER:
      case KEY.SPACE:
        // Entrée dans un champ = valider la recherche, comportement natif.
        if (typing) break;
        clickUnderCursor();
        e.preventDefault();
        break;

      case KEY.BACK:
      case KEY.RETURN:
        // Deuxième sortie du champ de saisie, la plus intuitive.
        if (typing) { leaveField(); e.preventDefault(); break; }
        // Sans historique, on laisse passer : c'est ce qui permet de quitter le
        // module et de revenir au launcher TizenBrew.
        if (window.history.length > 1) {
          window.history.back();
          e.preventDefault();
        }
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

  // Le curseur s'efface tout seul après quelques secondes sans appui, pour ne
  // pas rester planté au milieu d'un film. Il revient à la première flèche.
  // C'est un simple fondu d'opacité : contrairement à display:none, ça ne peut
  // pas laisser l'utilisateur sans pointeur, puisque rien n'est désactivé.
  function showCursor() {
    lastActivity = Date.now();
    if (cursorEl) cursorEl.style.opacity = "1";
  }

  function housekeeping() {
    ensureCursor();
    if (cursorEl && Date.now() - lastActivity > IDLE_HIDE_MS) cursorEl.style.opacity = "0";
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

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyle();
    initAdBlock();
    ensureCursor();
    document.addEventListener("play", onPlayCapture, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    setInterval(housekeeping, 1000);
    registerKeys();
    console.log("[Movix TizenBrew v5.0] curseur actif");
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

})();
