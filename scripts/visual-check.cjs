#!/usr/bin/env node
//
// Regarde ce que le compagnon dessine vraiment.
//
// Trois iterations de correctifs sont parties dans le vide faute de pouvoir OBSERVER : les
// tests unitaires disaient vrai, l'ecran disait autre chose. Ce harnais monte le vrai
// overlay et le vrai moteur, promene un curseur factice la ou ca coincait, et capture la
// fenetre a chaque etape.
//
// Ce qu'il montre : ou le compagnon est dessine, et s'il tient entier dans la zone utile.
// Ce qu'il ne montre PAS : les panneaux de l'environnement, dessines au-dessus de nous.
//
// En CommonJS : un point d'entree ESM avec `await` au premier niveau ne rend jamais la
// main a Electron.
//
// Usage : npx electron scripts/visual-check.cjs --ozone-platform=x11
const { app, screen: ecrans } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const SORTIE = 'release/visuel';
const ATTENTE_MS = 3000;

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Les bords et les coins : exactement la ou le compagnon se faisait couper. */
const etapes = (ecran) => [
  ['centre', 960, 540],
  ['haut', 960, 0],
  ['bas', 960, ecran.height - 1],
  ['gauche', 0, 540],
  ['droite', ecran.width - 1, 540],
  ['coin-haut-gauche', 0, 0],
  ['coin-bas-droite', ecran.width - 1, ecran.height - 1],
];

async function inspecter() {
  const { Overlay } = await import('../packages/app/dist/overlay/window.js');
  const { startLoop } = await import('../packages/app/dist/main/loop.js');
  const { createCompanion } = await import('../packages/app/dist/main/creature.js');
  const { discoverPacksIn } = await import('../packages/app/dist/packs/discover.js');

  const ecran = ecrans.getPrimaryDisplay().bounds;
  const zone = ecrans.getPrimaryDisplay().workArea;
  console.log(`VISUEL ecran=${JSON.stringify(ecran)} zoneUtile=${JSON.stringify(zone)}`);

  const position = { valeur: { x: 960, y: 540 } };
  const overlay = new Overlay();
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
      name: 'harnais',
      capabilities: { pointer: true, windows: true },
      pointer: () => Promise.resolve(position.valeur),
      windows: () => Promise.resolve([]),
      monitors: () => Promise.resolve(ecrans.getAllDisplays().map((d) => d.bounds)),
    },
    debug: false,
    workArea: () => zone,
  });

  // La vraie creature, pas le marqueur de repli : c'est elle qu'il faut regarder.
  const packs = await discoverPacksIn([join(__dirname, '..', 'packs')]);
  const compagnon = createCompanion({
    packs,
    sink: overlay,
    packId: packs[0] ? packs[0].pack.id : '',
    lineId: packs[0] && packs[0].pack.lines[0] ? packs[0].pack.lines[0].id : '',
  });

  await mkdir(SORTIE, { recursive: true });
  await attendre(1200);
  await compagnon.show(1);
  await attendre(800);

  for (const [nom, x, y] of etapes(ecran)) {
    position.valeur = { x, y };
    await attendre(ATTENTE_MS);

    const image = await overlay.capture();
    await writeFile(join(SORTIE, `${nom}.png`), image.toPNG());

    const pet = derniere && derniere.pet;
    const bas = pet ? Math.round(pet.y) : -1;
    const haut = bas - 96;
    const entier = haut >= zone.y && bas <= zone.y + zone.height;

    console.log(
      `VISUEL ${nom.padEnd(18)} curseur=${String(x).padStart(4)},${String(y).padStart(4)} ` +
        `compagnon=${String(pet ? Math.round(pet.x) : -1).padStart(4)},${String(bas).padStart(4)} ` +
        `corps=[${haut}..${bas}] ${entier ? 'entier' : 'DEBORDE'}`
    );
  }

  stop();
  overlay.destroy();
  app.quit();
}

app.whenReady().then(() => inspecter());
