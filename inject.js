/**
 * Movix TizenBrew — inject.js v4.0
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
 *  - Bord haut/bas       → fait défiler la page
 *  - OK                  → clic à la position du curseur
 *  - Retour              → page précédente
 *  - Dans le lecteur     → contrôle direct de la balise <video>, curseur masqué
 *  - Touches couleurs    → raccourcis Recherche / Accueil / À voir / Favoris
 *  - Anti-pub            → popups, iframes tierces, pièges à clic (ADBLOCK)
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
  margin: -3px 0 0 -3px;
  pointer-events: none;
  z-index: 2147483647;
  will-change: transform;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 2l14 9-6.2 1.4 3.4 6.4-3 1.6-3.4-6.5L5 19z' fill='%23ffffff' stroke='%23000000' stroke-width='1.6' stroke-linejoin='round'/></svg>") no-repeat center / contain;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6));
}

/* Le curseur pulse en rouge Movix au moment du clic */
#movix-tz-cursor.tz-click {
  transform-origin: 0 0;
  filter: drop-shadow(0 0 6px #e50914);
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
  //  - window.open()                → popups et popunders du site
  //  - iframes tierces              → mises en sandbox sans allow-popups ni
  //                                   allow-top-navigation, ce qui coupe les
  //                                   popunders et les redirections forcées
  //                                   des lecteurs embarqués (inatteignables
  //                                   autrement, ils sont cross-origin)
  //  - iframes invisibles/1px       → pubs et pixels de tracking, supprimées
  //  - overlays transparents        → les "click traps" plein écran qui volent
  //                                   le clic OK de la télécommande
  //  - clics vers un domaine tiers  → annulés, on ne quitte jamais Movix
  const ADBLOCK = true;

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
      if (hidden || r.width < 50 || r.height < 50) { f.remove(); continue; }
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

  // Un clic vers un domaine tiers ne mène nulle part d'utile sur une TV.
  function onClickCapture(e) {
    const t = e.target;
    const a = t && t.closest ? t.closest("a[href]") : null;
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
    if (!sameSite(href)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function initAdBlock() {
    if (!ADBLOCK) return;

    window.open = function () { return null; };
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

  function freezeDecorVideos() {
    if (!PAUSE_DECOR_VIDEOS || detectPage() === "player") return;
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
    if (v && v.tagName === "VIDEO" && v.loop && detectPage() !== "player") v.pause();
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
  const EDGE        = 80;    // à moins de 80 px du bord, la page défile
  const SCROLL_MULT = 1.3;   // le défilement suit la vitesse du curseur
  const KEY_TIMEOUT = 260;   // sans nouvel appui, la touche est jugée relâchée
  const HOVER_MS    = 120;   // fréquence des mousemove de synthèse

  let cursorEl = null;
  let cx = 0, cy = 0;
  let speed = SPEED_MIN;
  let loopId = null;
  let lastTick = 0;
  let lastHover = 0;
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

  function paintCursor() {
    // translate() plutôt que top/left : pas de recalcul de mise en page.
    if (cursorEl) cursorEl.style.transform = "translate(" + cx + "px," + cy + "px)";
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

  function sendHover() {
    const el = elementUnderCursor();
    if (!el) return;
    el.dispatchEvent(new MouseEvent("mouseover", mouseEventInit()));
    el.dispatchEvent(new MouseEvent("mousemove", mouseEventInit()));
  }

  function clickUnderCursor() {
    const el = elementUnderCursor();
    if (!el) return;
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
      clearInterval(loopId);
      loopId = null;
      sendHover(); // survol final, pour les aperçus au repos
      return;
    }

    speed = Math.min(SPEED_MAX, speed * (1 + ACCEL * dt));
    const step = speed * dt;
    const vw = window.innerWidth  || 1280;
    const vh = window.innerHeight || 720;

    cx += dx * step;
    cy += dy * step;

    // Contre le bord haut ou bas, le curseur ne sort pas : c'est la page qui
    // défile. C'est ce qui rend tout le site atteignable à la télécommande.
    if (dy < 0 && cy < EDGE)      { window.scrollBy(0, -step * SCROLL_MULT); cy = EDGE; }
    if (dy > 0 && cy > vh - EDGE) { window.scrollBy(0,  step * SCROLL_MULT); cy = vh - EDGE; }

    if (cx < 0) cx = 0;
    if (cx > vw - 1) cx = vw - 1;
    if (cy < 0) cy = 0;
    if (cy > vh - 1) cy = vh - 1;

    paintCursor();
    if (now - lastHover > HOVER_MS) { lastHover = now; sendHover(); }
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

  // ── Détection page ─────────────────────────────────────────────────────────

  function detectPage() {
    const p = location.pathname;
    if (p.includes("/watch") || p.includes("/player") || p.includes("/lecture")) return "player";
    if (p.includes("/search") || p.includes("/recherche")) return "search";
    if (p.includes("/movie") || p.includes("/film") || p.includes("/serie") || p.includes("/show") || p.includes("/anime")) return "detail";
    return "home";
  }

  // Vrai si l'utilisateur saisit du texte : on rend alors les flèches et Entrée
  // au champ, sinon la recherche est inutilisable.
  function isTyping() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = ae.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || ae.isContentEditable === true;
  }

  // ── Player : manipulation directe de la balise <video> ────────────────────
  //
  // Directement dans le DOM, pas dans un shadow DOM ni iframe. Beaucoup plus
  // fiable que de cliquer sur des boutons aux classes Tailwind instables.

  function getVideo() {
    return document.querySelector("video");
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

    // Dans le lecteur, les flèches pilotent la vidéo, pas le curseur.
    if (detectPage() === "player") {
      if (handlePlayerKeys(kc)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if ([KEY.RED, KEY.GREEN, KEY.YELLOW, KEY.BLUE].includes(kc)) {
      if (handleColorKeys(kc)) { e.preventDefault(); return; }
    }

    const typing = isTyping();
    const now = Date.now();

    switch (kc) {
      // Pendant une saisie, les flèches appartiennent au champ de texte.
      case KEY.LEFT:  if (typing) break; held.left  = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.RIGHT: if (typing) break; held.right = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.UP:    if (typing) break; held.up    = now; startCursorLoop(); e.preventDefault(); break;
      case KEY.DOWN:  if (typing) break; held.down  = now; startCursorLoop(); e.preventDefault(); break;

      case KEY.ENTER:
      case KEY.SPACE:
        // Entrée dans un champ = valider la recherche, comportement natif.
        if (typing) break;
        clickUnderCursor();
        e.preventDefault();
        break;

      case KEY.BACK:
      case KEY.RETURN:
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

  function housekeeping() {
    ensureCursor();
    if (cursorEl) cursorEl.style.display = detectPage() === "player" ? "none" : "block";
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
    console.log("[Movix TizenBrew v4.0] curseur actif, page:", detectPage());
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

})();
