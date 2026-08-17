#!/usr/bin/env node
//
// Enregistre la demonstration : un scenario joue par le VRAI moteur, capture image par
// image.
//
// Rien n'est mime. Le compagnon suit un curseur factice, se pose sur de vraies surfaces,
// parle par son cadenceur de parole et evolue par son systeme d'evolution. Ce qu'on voit
// dans le GIF est ce que fait l'application.
//
// La suite est assemblee par `scripts/build-demo.py`.
//
// Usage : npx electron scripts/record-demo.cjs --ozone-platform=x11
const { app, screen: ecrans } = require('electron');
const { mkdir, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const SORTIE = 'release/demo';
const FPS = 12;
const PAS_MS = Math.round(1000 / FPS);

/** Deux fenetres pour donner des perchoirs, dessinees a l'identique dans le fond. */
const FENETRES = [
  { x: 120, y: 210, width: 780, height: 560 },
  { x: 1020, y: 420, width: 760, height: 520 },
];

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ou le curseur s'immobilise.
 *
 * Volontairement loin des bords : c'est la que le compagnon parle et evolue, et une bulle
 * collee au bord de l'ecran serait coupee dans le GIF.
 */
const REPOS = { x: 620, y: 360 };

/**
 * De petits cercles autour du point de repos.
 *
 * Les deux derniers actes se jouent AVEC le curseur qui bouge : sans cela le compagnon
 * part vivre sa vie — il marche, se fatigue, et s'installe pour une vraie pause de trente
 * secondes dans un coin. Comportement juste, demonstration ratee : mesure sur un premier
 * enregistrement, il passait quatre-vingt-dix images immobile en bas a gauche.
 */
const RONDE = (t) => ({
  x: REPOS.x + Math.round(150 * Math.cos(t * 6)),
  y: REPOS.y + Math.round(90 * Math.sin(t * 6)),
});

/**
 * Le scenario, en actes.
 *
 * Chaque acte a un titre — il devient la legende du GIF — une duree, et de quoi bouger le
 * curseur. `avant` sert aux actes qui declenchent quelque chose : une phrase, une evolution.
 */
const ACTES = [
  {
    titre: 'Il te suit',
    duree: 4500,
    curseur: (t) => ({ x: 300 + Math.round(1200 * t), y: 300 + Math.round(260 * Math.sin(t * 3)) }),
  },
  { titre: 'Tu t’arretes, il se pose', duree: 5000, curseur: () => REPOS },
  { titre: 'Et il vit sa vie', duree: 4500, curseur: () => REPOS },
  {
    titre: 'Il remarque ce que tu fais',
    duree: 4500,
    curseur: RONDE,
    avant: (scene) => scene.voix.say({ key: 'speech.newScene', register: 'evenement' }),
  },
  {
    titre: 'Et il grandit avec toi',
    duree: 5500,
    curseur: RONDE,
    avant: (scene) => scene.compagnon.show(16, true),
  },
];

async function jouer(acte, scene, rang, positions) {
  if (acte.avant) await acte.avant(scene);

  const images = Math.round(acte.duree / PAS_MS);
  for (let i = 0; i < images; i += 1) {
    scene.position.valeur = acte.curseur(i / images);
    await attendre(PAS_MS);

    const nom = `${String(rang).padStart(2, '0')}-${String(i).padStart(4, '0')}.png`;
    await writeFile(join(SORTIE, nom), (await scene.overlay.capture()).toPNG());

    const vu = scene.frame();
    positions.push(vu && vu.pet ? { x: Math.round(vu.pet.x), y: Math.round(vu.pet.y) } : null);
  }

  return { titre: acte.titre, images };
}

async function enregistrer() {
  const { Overlay } = await import('../packages/app/dist/overlay/window.js');
  const { startLoop } = await import('../packages/app/dist/main/loop.js');
  const { createCompanion } = await import('../packages/app/dist/main/creature.js');
  const { discoverPacksIn } = await import('../packages/app/dist/packs/discover.js');
  const { Voice } = await import('../packages/app/dist/main/voice.js');
  const { systemClock } = await import('../packages/app/dist/adapters/clock.js');

  const zone = ecrans.getPrimaryDisplay().workArea;
  const position = { valeur: { x: 300, y: 300 } };
  const overlay = new Overlay();
  const voix = new Voice(() => 'fr', systemClock);

  const packs = await discoverPacksIn([join(__dirname, '..', 'packs')]);
  const premier = packs[0];
  const compagnon = createCompanion({
    packs,
    sink: overlay,
    packId: premier ? premier.pack.id : '',
    lineId: premier && premier.pack.lines[0] ? premier.pack.lines[0].id : '',
  });

  let derniere = null;
  const stop = startLoop({
    overlay: {
      origin: overlay.origin,
      send: (canal, charge) => {
        if (canal === 'perch:frame') derniere = charge;
        overlay.send(canal, charge);
      },
    },
    sensors: {
      name: 'demo',
      capabilities: { pointer: true, windows: true },
      pointer: () => Promise.resolve(position.valeur),
      windows: () => Promise.resolve(FENETRES),
      monitors: () => Promise.resolve(ecrans.getAllDisplays().map((d) => d.bounds)),
    },
    debug: false,
    workArea: () => zone,
    voice: voix,
  });

  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(SORTIE, { recursive: true });
  await compagnon.show(1);
  await attendre(1500);

  const scene = { position, overlay, voix, compagnon, frame: () => derniere };
  const actes = [];
  const positions = [];

  for (const [rang, acte] of ACTES.entries()) {
    actes.push(await jouer(acte, scene, rang, positions));
    console.log(`DEMO acte ${String(rang)} : ${acte.titre}`);
  }

  await writeFile(
    join(SORTIE, 'scenario.json'),
    JSON.stringify({ fps: FPS, fenetres: FENETRES, actes, positions }, null, 2)
  );

  stop();
  overlay.destroy();
  app.quit();
}

app.whenReady().then(() => enregistrer());
