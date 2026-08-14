import { readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

import type { Clip, ClipName, CreatureStage } from '@perch/core';

/** Une animation prête à jouer : les images sont embarquées, plus rien à ouvrir. */
export interface LoadedClip {
  readonly fps: number;
  readonly frames: readonly string[];
}

export type StageClips = Partial<Record<ClipName, LoadedClip>>;

const MIMES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Le chemin désigne-t-il bien quelque chose SOUS la racine ? */
function under(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Chemin absolu d'un asset, ou `null` s'il sort du pack.
 *
 * DEUXIÈME barrière : le schéma refuse déjà les chemins remontants, mais un manifeste est
 * une donnée externe, et un pack tiers s'installe en copiant un dossier.
 *
 * La vérification TEXTUELLE ne suffit pas — `sprites/x.png` peut être un lien symbolique
 * vers n'importe où. On la double donc d'une comparaison sur les chemins RÉELS, seule
 * capable de voir à travers un lien. Un fichier absent y échoue aussi, ce qui est le
 * comportement voulu.
 */
async function inside(directory: string, asset: string): Promise<string | null> {
  const root = resolve(directory);
  const target = resolve(root, asset);

  if (!under(root, target)) return null;
  if (MIMES[extname(target).toLowerCase()] === undefined) return null;

  try {
    const [reelRoot, reelTarget] = await Promise.all([realpath(root), realpath(target)]);
    return under(reelRoot, reelTarget) ? reelTarget : null;
  } catch {
    return null;
  }
}

/**
 * Lit une image et l'encode en URL de données.
 *
 * Le rendu ne touche JAMAIS au disque : sa politique de sécurité de contenu n'autorise
 * aucune source de fichier, et il tourne en bac à sable. Passer les images encodées par
 * IPC coûte quelques dizaines de kilo-octets une fois par évolution, et évite d'ouvrir
 * l'accès au système de fichiers à une page web.
 *
 * Renvoie `null` sur asset manquant : un pack incomplet doit dégrader, pas planter — le
 * dépôt ne contient aucun sprite (invariant I5), un utilisateur qui n'a pas lancé le
 * téléchargement doit quand même voir son compagnon bouger.
 */
async function encode(directory: string, asset: string): Promise<string | null> {
  const path = await inside(directory, asset);
  if (path === null) return null;

  try {
    const bytes = await readFile(path);
    const mime = MIMES[extname(path).toLowerCase()] ?? 'application/octet-stream';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Charge une animation. `null` dès qu'une seule image manque : mieux vaut se rabattre. */
async function loadClip(directory: string, clip: Clip): Promise<LoadedClip | null> {
  const frames = await Promise.all(clip.frames.map(async (frame) => encode(directory, frame)));
  const usable = frames.filter((frame): frame is string => frame !== null);

  return usable.length === frames.length ? { fps: clip.fps, frames: usable } : null;
}

/**
 * Image fixe d'un stade, pour la fenêtre de choix.
 *
 * Séparé du chargement des animations : proposer six lignées ne demande que six images,
 * alors que charger leurs stades complets encoderait en base64 toutes les frames de tous
 * les clips — plusieurs mégaoctets pour n'en afficher qu'une par créature.
 */
export async function loadPortrait(
  directory: string,
  stage: CreatureStage
): Promise<string | null> {
  return encode(directory, stage.sprite);
}

/** Charge les animations d'un stade. */
export async function loadClips(directory: string, stage: CreatureStage): Promise<StageClips> {
  const named = Object.entries(stage.clips).filter(
    (entry): entry is [ClipName, Clip] => entry[1] !== undefined
  );

  const loaded = await Promise.all(
    named.map(async ([name, clip]) => {
      const result = await loadClip(directory, clip);
      return result === null ? null : ([name, result] as const);
    })
  );

  const clips: StageClips = {};
  for (const entry of loaded) {
    if (entry !== null) clips[entry[0]] = entry[1];
  }

  return clips;
}
