// Rendu de l'overlay.
//
// Ce fichier NE DÉCIDE RIEN. Il reçoit une position déjà simulée et une table qui associe
// à chaque état une animation et sa cadence, toutes deux calculées par du code testé. Le
// choix de l'animation vivait ici auparavant : c'était du vocabulaire de jeu réécrit en
// JavaScript qu'aucun test ne lisait, et qui divergeait à la première évolution du moteur.
(() => {
  'use strict';

  const par = (id) => document.getElementById(id);

  const pet = par('pet');
  const bulle = par('bulle');
  const corps = par('corps');
  const repli = par('repli');
  const hud = par('hud');
  const svg = par('surfaces');

  /** Interpolation vers la position simulée : voir `lisser`. */
  const LISSAGE = 0.35;
  /** Au-delà, on saute au lieu d'interpoler : un placement initial n'est pas un trajet. */
  const SAUT_MAX = 400;
  const EVOLUTION_MS = 1800;
  /** Le HUD de mise au point ne redessine pas les surfaces à chaque frame. */
  const SURFACES_TOUS_LES = 20;

  let frame = null;
  let peint = 0;

  // Position AFFICHÉE, distincte de la position simulée. Le moteur est autoritaire mais
  // son pas dépend d'un aller-retour D-Bus : la cadence n'est jamais parfaitement
  // régulière, et appliquer sa sortie telle quelle rend la gigue visible.
  let vueX = null;
  let vueY = null;

  let creature = null;
  let stadeAffiche = null;
  let clipCourant = null;
  let indexFrame = 0;
  let accumule = 0;
  let dernier = performance.now();

  function dessinerSurfaces(f) {
    svg.innerHTML = f.surfaces
      .map((s) => {
        const teinte = s.kind === 'ecran' ? 'rgb(155,141,240)' : 'rgb(233,178,94)';
        const y = s.y - f.origin.y;
        return `<line x1="${s.start - f.origin.x}" y1="${y}" x2="${s.end - f.origin.x}" y2="${y}" stroke="${teinte}" stroke-width="3"/>`;
      })
      .join('');
  }

  function jouerEvolution() {
    // Retrait puis reflow forcé : sans cela, une seconde évolution dans la même session
    // ne rejouerait rien, la classe étant déjà posée.
    pet.classList.remove('evolue');
    void pet.offsetWidth;
    pet.classList.add('evolue');
    setTimeout(() => pet.classList.remove('evolue'), EVOLUTION_MS);
  }

  window.perch.onCreature((recue) => {
    creature = recue;
    clipCourant = null;
    indexFrame = 0;
    accumule = 0;

    // Seconde barrière : le processus principal ne conserve jamais le drapeau d'évolution
    // pour un rejeu, et l'on vérifie ici que le stade a bien changé. Deux gardes valent
    // mieux qu'une pour un effet qui se voit sur tout le bureau.
    if (recue.evolved && recue.stageId !== stadeAffiche) jouerEvolution();
    stadeAffiche = recue.stageId;
  });

  function animer(etat, dt) {
    const lecture = creature === null ? undefined : creature.byState[etat];
    const images = lecture === undefined ? undefined : creature.frames[lecture.clip];

    if (images === undefined || images.length === 0) {
      repli.hidden = false;
      corps.hidden = true;
      return;
    }

    if (lecture.clip !== clipCourant) {
      clipCourant = lecture.clip;
      indexFrame = 0;
      accumule = 0;
    }

    accumule += dt * lecture.fps;
    while (accumule >= 1) {
      accumule -= 1;
      indexFrame = (indexFrame + 1) % images.length;
    }

    if (corps.getAttribute('src') !== images[indexFrame]) {
      corps.setAttribute('src', images[indexFrame]);
    }
    corps.hidden = false;
    repli.hidden = true;
  }

  function afficherHud(f) {
    hud.hidden = false;
    hud.textContent =
      `capteurs  ${f.backend}\n` +
      `etat      ${f.pet.state}\n` +
      `position  ${Math.round(f.pet.x)}, ${Math.round(f.pet.y)}\n` +
      `curseur   ${f.pointer ? `${f.pointer.x}, ${f.pointer.y}` : 'inconnu'}\n` +
      `surfaces  ${f.surfaces.length}`;

    peint += 1;
    if (peint % SURFACES_TOUS_LES === 1) dessinerSurfaces(f);
  }

  window.perch.onFrame((recue) => {
    frame = recue;

    // Plein écran : le compagnon se cache entièrement, il ne se contente pas de se taire.
    pet.hidden = recue.hidden === true;

    // Le texte n'est PAS effacé en même temps que la classe : la bulle disparaît par une
    // transition d'un quart de seconde, et la vider tout de suite laisserait une boîte
    // jaune vide s'estomper toute seule.
    if (recue.bubble) bulle.textContent = recue.bubble;
    bulle.classList.toggle('visible', Boolean(recue.bubble));

    if (recue.debug) {
      afficherHud(recue);
      return;
    }
    hud.hidden = true;
    svg.innerHTML = '';
  });

  /** Rapproche la position affichée de la position simulée, sans jamais la dépasser. */
  function lisser(cibleX, cibleY) {
    if (
      vueX === null ||
      vueY === null ||
      Math.abs(cibleX - vueX) + Math.abs(cibleY - vueY) > SAUT_MAX
    ) {
      vueX = cibleX;
      vueY = cibleY;
      return;
    }
    vueX += (cibleX - vueX) * LISSAGE;
    vueY += (cibleY - vueY) * LISSAGE;
  }

  function tick(maintenant) {
    // Borné : au réveil après une veille, le delta vaut plusieurs minutes et l'animation
    // défilerait d'un coup jusqu'à une image au hasard.
    const dt = Math.min((maintenant - dernier) / 1000, 0.25);
    dernier = maintenant;

    if (frame !== null) {
      lisser(frame.pet.x - frame.origin.x, frame.pet.y - frame.origin.y);
      pet.style.transform = `translate3d(${vueX.toFixed(1)}px, ${vueY.toFixed(1)}px, 0) scaleX(${frame.pet.facing})`;
      pet.dataset.etat = frame.pet.state;
      animer(frame.pet.state, dt);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
