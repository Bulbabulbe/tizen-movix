/**
 * Movix TizenBrew — inject.js v3.2
 * Basé sur https://github.com/Mathr81/movix-tizenbrew (auteur original : Mathr81).
 * Ce fork met le module au format TizenBrew actuel (packageType "mods") et
 * embarque le CSS directement ici, car TizenBrew ne charge qu'un seul fichier
 * JS (champ "main"). inject.css reste dans le dépôt comme source de référence.
 *
 * Stratégie (inchangée) :
 *  - Navigation D-pad    → algorithme directionnel sur éléments focusables
 *  - Player play/pause   → video.play() / video.pause() directement (plus fiable que les boutons)
 *  - Player seek         → video.currentTime += / -= 10
 *  - Retour player       → bouton "← Retour"
 *  - Touches couleurs    → raccourcis Recherche / Accueil / À voir / Favoris
 *  - Anti-pub            → popups, iframes tierces, pièges à clic (ADBLOCK)
 *
 * Note compatibilité : pas de `?.` ni de syntaxe ES2020+, les WebViews Tizen
 * 3.x/4.x (Chromium 47/56) refusent de parser le fichier entier sinon.
 */

(function () {
  "use strict";

  // ── CSS embarqué (source : inject.css) ────────────────────────────────────
  const STYLE_ID = "movix-tizenbrew-style";
  const CSS = `
/* Pas de curseur souris sur TV */
* { cursor: none !important; }

/* Scrollbars inutiles */
::-webkit-scrollbar { display: none; }

/* ── Anneau de focus — reprend le rouge Movix (#e50914) ── */
.tz-focus {
  outline: 4px solid #e50914 !important;
  outline-offset: 3px !important;
  box-shadow:
    0 0 0 6px rgba(229, 9, 20, 0.3),
    0 0 24px rgba(229, 9, 20, 0.5) !important;
  transform: scale(1.07) !important;
  transition: transform 0.12s ease, box-shadow 0.12s ease !important;
  z-index: 9999 !important;
  position: relative !important;
}

/* Cards films : effet de zoom plus marqué */
.tz-focus[class*="card"],
.tz-focus[class*="Card"],
.tz-focus[class*="poster"],
.tz-focus[class*="Poster"] {
  transform: scale(1.12) !important;
  box-shadow: 0 10px 40px rgba(229, 9, 20, 0.55) !important;
}

/* Boutons : léger fond rouge */
button.tz-focus,
.tz-focus button,
[role="button"].tz-focus {
  background: rgba(229, 9, 20, 0.15) !important;
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

    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.tagName === "IFRAME") hardenIframe(n);
          else if (n.querySelectorAll) {
            const inner = n.querySelectorAll("iframe");
            for (const f of inner) hardenIframe(f);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    sweepAds();
    setInterval(sweepAds, 1500);
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

  // ── Sélecteurs focusables pour la navigation hors player ──────────────────
  const FOCUSABLE = [
    "nav a", "header a",
    "input[type='search']", "input[placeholder]",
    "button:not([disabled])",
    "[role='button']", "[role='tab']",
    "a[href]",
  ].join(", ");

  let currentFocus = null;
  let initialized  = false;
  let lastPath     = location.pathname;

  // ── Utilitaires ────────────────────────────────────────────────────────────

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0
      && s.visibility !== "hidden"
      && s.display    !== "none"
      && s.opacity    !== "0"
      && !el.hasAttribute("disabled");
  }

  function getFocusable() {
    return Array.from(document.querySelectorAll(FOCUSABLE)).filter(isVisible);
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Vrai si l'utilisateur est en train de saisir du texte : on rend alors
  // gauche/droite et Entrée au champ, sinon la recherche est inutilisable.
  function isTyping() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = ae.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || ae.isContentEditable === true;
  }

  // ── Navigation directionnelle ──────────────────────────────────────────────

  function findNext(dir) {
    const els = getFocusable();
    if (!els.length) return null;
    if (!currentFocus || !document.contains(currentFocus)) return els[0];

    const cc = center(currentFocus);
    let best = null, bestScore = Infinity;

    for (const el of els) {
      if (el === currentFocus) continue;
      const ec = center(el);
      const dx = ec.x - cc.x, dy = ec.y - cc.y;
      let ok = false, primary = 0, secondary = 0;

      switch (dir) {
        case "left":  ok = dx < -5; primary = -dx; secondary = Math.abs(dy); break;
        case "right": ok = dx >  5; primary =  dx; secondary = Math.abs(dy); break;
        case "up":    ok = dy < -5; primary = -dy; secondary = Math.abs(dx); break;
        case "down":  ok = dy >  5; primary =  dy; secondary = Math.abs(dx); break;
      }
      if (!ok) continue;
      const score = primary + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function setFocus(el) {
    if (!el) return;
    if (currentFocus) {
      currentFocus.classList.remove("tz-focus");
      currentFocus.removeAttribute("data-tz");
    }
    currentFocus = el;
    el.classList.add("tz-focus");
    el.setAttribute("data-tz", "1");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function navigate(dir) {
    const n = findNext(dir);
    if (n) setFocus(n);
  }

  // ── Détection page ─────────────────────────────────────────────────────────

  function detectPage() {
    const p = location.pathname;
    if (p.includes("/watch") || p.includes("/player") || p.includes("/lecture")) return "player";
    if (p.includes("/search") || p.includes("/recherche")) return "search";
    if (p.includes("/movie") || p.includes("/film") || p.includes("/serie") || p.includes("/show") || p.includes("/anime")) return "detail";
    return "home";
  }

  // ── Player : manipulation directe de la balise <video> ────────────────────
  //
  // D'après le HTML : <video class="w-full h-full object-contain ...">
  // Directement dans le DOM, pas dans un shadow DOM ni iframe.
  // Beaucoup plus fiable que de cliquer sur des boutons aux classes Tailwind instables.

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

  // Bouton "← Retour" du player : button.absolute.top-4.left-4
  // C'est le seul bouton avec aria-hidden="false" et la classe "absolute top-4 left-4"
  function clickRetour() {
    // Cherche le bouton Retour par son contenu texte ou ses classes de position
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
        // Volume +
        const v = getVideo();
        if (v) { v.volume = Math.min(1, v.volume + 0.1); return true; }
        return false;
      }

      case KEY.DOWN: {
        // Volume -
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
        if (inp) { setFocus(inp); inp.click(); return true; }
        const sl = document.querySelector("a[href*='search'], a[href*='recherche']");
        if (sl) { sl.click(); return true; }
        return false;
      }

      case KEY.GREEN: {
        const hl = document.querySelector("a[href='/'], [class*='logo'] a, .logo a");
        if (hl) { hl.click(); return true; }
        return false;
      }

      case KEY.YELLOW: {
        // Bouton "À voir" page film
        const btns = Array.from(document.querySelectorAll("button"));
        const aVoir = btns.find(b => b.textContent.trim().includes("À voir") || b.textContent.trim().includes("voir"));
        if (aVoir) { aVoir.click(); return true; }
        return false;
      }

      case KEY.BLUE: {
        // Bouton "Favoris" page film
        const btns = Array.from(document.querySelectorAll("button"));
        const fav = btns.find(b => b.textContent.trim().includes("Favoris"));
        if (fav) { fav.click(); return true; }
        return false;
      }
    }
    return false;
  }

  // ── Handler principal ──────────────────────────────────────────────────────

  function onKeyDown(e) {
    const kc   = e.keyCode;
    const page = detectPage();

    // Dans le player : tout est géré par handlePlayerKeys
    if (page === "player") {
      if (handlePlayerKeys(kc)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      return; // Laisse passer les touches non gérées (ex: touches système)
    }

    // Touches couleurs sur toutes les pages hors player
    if ([KEY.RED, KEY.GREEN, KEY.YELLOW, KEY.BLUE].includes(kc)) {
      if (handleColorKeys(kc)) { e.preventDefault(); return; }
    }

    const typing = isTyping();

    // Navigation D-pad
    switch (kc) {
      // Gauche/droite déplacent le curseur quand on saisit du texte.
      case KEY.LEFT:  if (typing) break; navigate("left");  e.preventDefault(); break;
      case KEY.RIGHT: if (typing) break; navigate("right"); e.preventDefault(); break;
      case KEY.UP:    navigate("up");    e.preventDefault(); break;
      case KEY.DOWN:  navigate("down");  e.preventDefault(); break;

      case KEY.ENTER:
      case KEY.SPACE:
        // Entrée dans un champ = valider la recherche, comportement natif.
        if (typing) break;
        if (currentFocus) {
          const tag = currentFocus.tagName.toLowerCase();
          if (tag === "input") { currentFocus.focus(); currentFocus.click(); }
          else currentFocus.click();
          e.preventDefault();
        }
        break;

      case KEY.BACK:
      case KEY.RETURN:
        // S'il n'y a pas d'historique, on laisse passer : c'est ce qui permet
        // de quitter le module et de revenir au launcher TizenBrew.
        if (window.history.length > 1) {
          window.history.back();
          e.preventDefault();
        }
        break;
    }
  }

  // ── Focus initial selon la page ────────────────────────────────────────────

  function initFocus() {
    setTimeout(() => {
      const page = detectPage();
      let target = null;

      if (page === "player") {
        // Dans le player, on ne met pas de focus visuel —
        // les touches sont gérées directement sur la vidéo
        return;
      } else if (page === "detail") {
        // Bouton "Regarder" (rouge, premier gros bouton)
        const btns = Array.from(document.querySelectorAll("button"));
        target = btns.find(b => b.textContent.trim().includes("Regarder"));
      } else if (page === "search") {
        target = document.querySelector("input[type='search'], input[placeholder]");
      } else {
        // Accueil : bouton "Lecture" du hero
        const btns = Array.from(document.querySelectorAll("button"));
        target = btns.find(b => b.textContent.trim().includes("Lecture"));
      }

      const els = getFocusable();
      if (target && isVisible(target)) setFocus(target);
      else if (els.length) setFocus(els[0]);
    }, 700);
  }

  // ── Observer SPA React Router ──────────────────────────────────────────────

  function setupObserver() {
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        currentFocus = null;
        initFocus();
      }
    }, 250);

    new MutationObserver((ms) => {
      if (ms.some(m => m.addedNodes.length > 3)
          && (!currentFocus || !document.contains(currentFocus))
          && detectPage() !== "player") {
        initFocus();
      }
    }).observe(document.body, { childList: true, subtree: true });
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

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyle();
    initAdBlock();
    registerKeys();
    document.addEventListener("keydown", onKeyDown, true);
    setupObserver();
    initFocus();
    console.log("[Movix TizenBrew v3.2] page:", detectPage());
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

})();
