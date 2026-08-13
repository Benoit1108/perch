import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';

import type { Rect } from '@perch/core';
import { boundingBox } from '@perch/core';

/**
 * L'overlay : une grande fenêtre transparente couvrant l'union des écrans, dans laquelle
 * le compagnon est déplacé en CSS.
 *
 * Ce fichier concentre quatre pièges mesurés en S0 (spike/README.md). Les ignorer produit
 * une fenêtre qui existe, que GNOME liste, dont `isVisible()` renvoie `true` — et que
 * personne ne voit.
 */
export class Overlay {
  private readonly window: BrowserWindow;
  private bounds: Rect = { x: 0, y: 0, width: 1, height: 1 };

  constructor() {
    this.bounds = this.desktopBounds();

    this.window = new BrowserWindow({
      ...this.bounds,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      enableLargerThanScreen: true,
      webPreferences: {
        preload: fileURLToPath(new URL('../renderer/preload.cjs', import.meta.url)),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.applyClickThrough();
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    this.window.webContents.on('did-finish-load', () => {
      // Mutter écrête la taille à la CRÉATION : seule une reprise après affichage passe.
      //
      // Les clics traversants sont ré-appliqués INCONDITIONNELLEMENT ici. L'appel fait
      // dans le constructeur ne tient pas — la fenêtre n'est pas encore réalisée — et
      // `syncBounds` sort tôt quand la géométrie n'a pas bougé. Sans cette ligne,
      // l'overlay avale 100 % des clics du bureau (constat S0 n°7).
      setTimeout(() => {
        this.syncBounds('apres affichage');
        this.applyClickThrough();
      }, 300);
      setTimeout(() => {
        this.applyClickThrough();
      }, 1200);
    });

    // Enregistrements séparés : les surcharges de `screen.on` n'acceptent pas une union
    // de noms d'événements.
    screen.on('display-added', () => {
      this.syncBounds('display-added');
    });
    screen.on('display-removed', () => {
      this.syncBounds('display-removed');
    });
    screen.on('display-metrics-changed', () => {
      this.syncBounds('display-metrics-changed');
    });

    // Certains écrans apparaissent SANS émettre d'événement exploitable : au démarrage,
    // `screen.getAllDisplays()` peut n'en connaître qu'un seul et rester muet sur les
    // autres. Constat S0 n°3 — sans cette reprise, l'overlay ne couvre qu'un tiers du
    // bureau, de façon non déterministe.
    const settle = setInterval(() => {
      this.syncBounds('stabilisation');
    }, 1000);
    setTimeout(() => {
      clearInterval(settle);
    }, 10_000);

    void this.window.loadFile(fileURLToPath(new URL('../renderer/overlay.html', import.meta.url)));
  }

  /** Union englobante des écrans. Inclut le vide : c'est `core` qui sait où l'on peut marcher. */
  private desktopBounds(): Rect {
    const displays = screen.getAllDisplays();
    if (process.env['PERCH_DEBUG'] === '1') {
      const resume = displays
        .map(
          (d) =>
            `${String(d.bounds.width)}x${String(d.bounds.height)}@${String(d.bounds.x)},${String(d.bounds.y)}`
        )
        .join(' | ');
      console.log(`[perch] ecrans vus par Electron : ${String(displays.length)} — ${resume}`);
    }
    const box = boundingBox(displays.map((display) => display.bounds));
    return box ?? { x: 0, y: 0, width: 1, height: 1 };
  }

  /**
   * Les clics doivent traverser l'overlay.
   *
   * À RÉ-APPLIQUER après chaque changement de géométrie : la région d'entrée est attachée
   * à la fenêtre X et un redimensionnement la réinitialise. C'est ce qui, en S0, faisait
   * avaler à l'overlay 100 % des clics du bureau.
   */
  private applyClickThrough(): void {
    this.window.setIgnoreMouseEvents(true);
  }

  /**
   * Recalcule et ré-applique la géométrie.
   *
   * `screen.getAllDisplays()` n'est pas fiable au démarrage : un lancement sur deux ne
   * voit qu'un seul écran, les autres arrivant par événement ensuite.
   */
  syncBounds(reason: string): void {
    if (this.window.isDestroyed()) return;

    const next = this.desktopBounds();
    const actual = this.window.getBounds();
    const drifted =
      actual.x !== next.x ||
      actual.y !== next.y ||
      actual.width !== next.width ||
      actual.height !== next.height;

    if (!drifted) return;

    this.bounds = next;
    this.window.setBounds(next);
    this.applyClickThrough();

    const after = this.window.getBounds();
    const geometrie = `${String(after.width)}x${String(after.height)}@${String(after.x)},${String(after.y)}`;
    console.log(`[perch] surface ${geometrie} (${reason})`);
  }

  get origin(): Rect {
    return this.bounds;
  }

  send(channel: string, payload: unknown): void {
    if (this.window.isDestroyed()) return;
    this.window.webContents.send(channel, payload);
  }

  destroy(): void {
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
