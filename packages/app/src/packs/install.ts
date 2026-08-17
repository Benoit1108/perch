import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseCreaturePack } from '@perch/core';

import { writeAtomic } from '../adapters/atomic.js';

import type { SpeciesFamily } from './species.js';

/** Où atterrissent les créatures choisies : un pack qui appartient à l'utilisateur. */
export const PACK_PERSONNEL = 'perso';

/** Source des sprites animés, la même que celle du pack livré. */
const SPRITES = 'https://play.pokemonshowdown.com/sprites/ani';

/**
 * Paliers d'évolution.
 *
 * Les mêmes que ceux du pack livré : une lignée à trois stades change au niveau 16 puis
 * 36. Une lignée plus courte n'utilise que le début de la liste.
 */
const PALIERS = [1, 16, 36];

/**
 * Installe une lignée dans le pack personnel, en téléchargeant ses images.
 *
 * INVARIANT I5 — rien n'est versionné : les sprites arrivent ici, dans le dossier de
 * l'utilisateur, au moment où il choisit sa créature.
 *
 * Le GIF est utilisé TEL QUEL, sans retaillage. Ceux de cette source sont déjà détourés au
 * plus juste et calés en bas, et le rendu sait les animer nativement — c'est ce qui permet
 * de se passer de Python à l'exécution.
 */
export async function installSpecies(
  packsRoot: string,
  famille: SpeciesFamily,
  /** Nom du pack tel qu'il apparaîtra dans le manifeste — traduit par l'appelant (I8). */
  packName: string
): Promise<{ readonly packId: string; readonly lineId: string }> {
  const dossier = join(packsRoot, PACK_PERSONNEL);
  await mkdir(join(dossier, 'sprites'), { recursive: true });

  const stades = famille.stages.slice(0, PALIERS.length);
  await Promise.all(stades.map(async (stade) => telecharger(dossier, stade.id)));

  const ligne = {
    id: famille.id,
    stages: stades.map((stade, rang) => ({
      id: stade.id,
      name: stade.fr,
      species: stade.id,
      sprite: `sprites/${stade.id}.gif`,
      fromLevel: PALIERS[rang] ?? 1,
      clips: { repos: { frames: [`sprites/${stade.id}.gif`], fps: 1 } },
    })),
  };

  await writeAtomic(
    join(dossier, 'manifest.json'),
    `${JSON.stringify(await fusionner(dossier, ligne, packName), null, 2)}\n`
  );

  return { packId: PACK_PERSONNEL, lineId: famille.id };
}

async function telecharger(dossier: string, id: string): Promise<void> {
  const reponse = await fetch(`${SPRITES}/${id}.gif`);
  if (!reponse.ok) throw new Error(`sprite de « ${id} » indisponible (${String(reponse.status)})`);

  await mkdir(join(dossier, 'sprites'), { recursive: true });
  await writeAtomic(
    join(dossier, 'sprites', `${id}.gif`),
    new Uint8Array(await reponse.arrayBuffer())
  );
}

/**
 * Ajoute la lignée au manifeste existant, ou en crée un.
 *
 * Le pack personnel s'ACCUMULE : choisir une nouvelle créature n'efface pas les
 * précédentes, on peut donc y revenir sans re-télécharger. Une lignée déjà présente est
 * remplacée, ce qui répare au passage un téléchargement interrompu.
 */
async function fusionner(dossier: string, ligne: unknown, nom: string): Promise<unknown> {
  const chemin = join(dossier, 'manifest.json');
  const parLigne = new Map<string, unknown>();

  try {
    const existant = parseCreaturePack(JSON.parse(await readFile(chemin, 'utf8')));
    for (const precedente of existant.lines) parLigne.set(precedente.id, precedente);
  } catch {
    // Aucun manifeste, ou un manifeste illisible : on repart de celui qu'on écrit.
  }

  const identifiant = typeof ligne === 'object' && ligne !== null && 'id' in ligne ? ligne.id : '';
  parLigne.set(String(identifiant), ligne);

  return {
    schemaVersion: 1,
    id: PACK_PERSONNEL,
    name: nom,
    license: 'Sprites Pokémon Showdown — fan-art, usage non commercial. Téléchargés à la demande.',
    lines: [...parLigne.values()],
  };
}
