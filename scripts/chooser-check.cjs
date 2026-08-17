#!/usr/bin/env node
//
// Regarde la fenetre de choix, et adopte pour de vrai.
//
// Meme raison d'etre que `visual-check.cjs` : ce qui compte est ce qui s'affiche, pas ce
// qu'on deduit du code. Le harnais monte la VRAIE fenetre, tape dans le champ, clique sur
// une proposition, et laisse le telechargement se faire.
//
// Rien n'est ecrit chez l'utilisateur : le dossier de donnees est jetable.
//
// Usage : npx electron scripts/chooser-check.cjs --ozone-platform=x11
const { app, BrowserWindow } = require('electron');
const { mkdtemp, readFile, writeFile, mkdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const SORTIE = 'release/choix';
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capturer(nom) {
  const fenetre = BrowserWindow.getAllWindows()[0];
  if (!fenetre) return console.log(`CHOIX ${nom} : plus de fenetre`);

  await writeFile(join(SORTIE, `${nom}.png`), (await fenetre.capturePage()).toPNG());
  console.log(`CHOIX ${nom} : capture`);
}

/** Ce que fait un utilisateur : il tape, et les evenements partent tout seuls. */
async function taper(texte) {
  const fenetre = BrowserWindow.getAllWindows()[0];
  await fenetre.webContents.executeJavaScript(
    `(() => {
       const champ = document.getElementById('recherche');
       champ.value = ${JSON.stringify(texte)};
       champ.dispatchEvent(new Event('input'));
     })()`
  );
}

async function verifier() {
  const jetable = await mkdtemp(join(tmpdir(), 'perch-choix-'));
  app.setPath('userData', jetable);

  const { configureChooser, openChooser } = await import('../packages/app/dist/chooser/window.js');
  const { createAdoption } = await import('../packages/app/dist/packs/adopt.js');
  const { createPackRegistry } = await import('../packages/app/dist/packs/registry.js');
  const { loadCatalogue } = await import('../packages/app/dist/packs/species.js');
  const { createCompanion } = await import('../packages/app/dist/main/creature.js');

  // Les packs du depot ET le dossier jetable : on voit donc les creatures deja installees
  // en haut, et celles du catalogue en bas.
  const registry = await createPackRegistry([jetable, join(__dirname, '..', 'packs')]);
  const compagnon = createCompanion({
    packs: registry.all,
    // Le compagnon n'est monte que pour ses PORTRAITS : rien n'est dessine ici.
    sink: { retain: () => undefined },
    packId: '',
    lineId: '',
  });

  const adoption = createAdoption({
    registry,
    root: () => join(jetable, 'packs'),
    catalogue: loadCatalogue,
    packName: () => 'Mes créatures',
  });

  configureChooser({
    locale: () => 'fr',
    choices: () => compagnon.choices(),
    offers: () => true,
    onPick: () => Promise.resolve(),
    search: (query) => adoption.search(query),
    onAdopt: async (familyId) => {
      const adoptee = await adoption.adopt(familyId);
      console.log('CHOIX adoption :', JSON.stringify(adoptee));
      return adoptee !== null;
    },
  });

  await mkdir(SORTIE, { recursive: true });
  openChooser();
  await attendre(1500);
  await capturer('1-ouvert');

  await taper('fantomi');
  await attendre(600);
  await capturer('2-recherche');

  await taper('pas-une-creature');
  await attendre(600);
  await capturer('3-introuvable');

  await taper('fantomi');
  await attendre(600);
  const fenetre = BrowserWindow.getAllWindows()[0];
  await fenetre.webContents.executeJavaScript(
    `document.querySelector('button.suggestion').click()`
  );
  await attendre(250);
  await capturer('4-telechargement');

  await attendre(6000);
  console.log(`CHOIX fenetre fermee : ${String(BrowserWindow.getAllWindows().length === 0)}`);

  const manifeste = await readFile(join(jetable, 'packs', 'perso', 'manifest.json'), 'utf8');
  console.log('CHOIX manifeste :', manifeste.replace(/\s+/gu, ' ').slice(0, 260));

  app.quit();
}

app.whenReady().then(() => verifier());
