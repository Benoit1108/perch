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
  /**
   * Derniers messages à rejouer dès que la page est prête.
   *
   * Sans eux, l'apparence du compagnon se perdait au démarrage : elle est envoyée UNE
   * fois, quelques dizaines de millisecondes après la création de la fenêtre, alors que
   * la page met quelques centaines de millisecondes à brancher ses écouteurs. Le
   * compagnon restait un marqueur sans nom jusqu'à sa prochaine évolution — des jours.
   */
  private readonly retained = new Map<string, unknown>();
  private loaded = false;
  private readonly rang: ReturnType<typeof setInterval>;

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
      // Affichée SANS prendre le focus. Une fenêtre qui s'ouvre au premier plan reçoit les
      // clics tant qu'elle le garde, quels que soient les réglages de transparence aux
      // clics : au lancement, il fallait passer sur une autre application pour « rendre »
      // la souris au bureau.
      show: false,
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

    this.applyOverlayFlags();
    this.window.showInactive();

    this.window.webContents.on('did-finish-load', () => {
      // Rejoué à CHAQUE chargement, pas seulement au premier : une page qui tombe et se
      // relance repartirait sinon sans aucune créature.
      this.loaded = true;
      for (const [channel, payload] of this.retained) {
        this.window.webContents.send(channel, payload);
      }

      // Mutter écrête la taille à la CRÉATION : seule une reprise après affichage passe.
      //
      // Les attributs sont ré-appliqués INCONDITIONNELLEMENT ici. L'appel fait dans le
      // constructeur ne tient pas — la fenêtre n'est pas encore réalisée — et `syncBounds`
      // sort tôt quand la géométrie n'a pas bougé. Sans cette reprise, l'overlay avale
      // 100 % des clics du bureau (constat S0 n°7).
      setTimeout(() => {
        this.syncBounds('apres affichage');
        this.applyOverlayFlags();
      }, 300);
      setTimeout(() => {
        this.applyOverlayFlags();
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

    // Le rang « au-dessus » ne tient pas tout seul : le gestionnaire de fenêtres le perd
    // au fil des ouvertures et des changements de bureau, et le compagnon finit derrière
    // le terminal. On le réaffirme donc régulièrement — un appel toutes les cinq secondes
    // ne coûte rien, et `syncBounds` ne suffit pas puisqu'il sort tôt quand la géométrie
    // n'a pas bougé.
    this.rang = setInterval(() => {
      if (!this.window.isDestroyed()) this.applyOverlayFlags();
    }, 5_000);

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
   * Les trois attributs qui font un overlay : invisible aux clics, au-dessus de tout, et
   * présent sur tous les bureaux.
   *
   * À RÉ-APPLIQUER ENSEMBLE après chaque changement de géométrie. La région d'entrée est
   * attachée à la fenêtre X et un redimensionnement la réinitialise — c'est ce qui, en S0,
   * faisait avaler à l'overlay 100 % des clics du bureau. Le gestionnaire de fenêtres perd
   * de la même façon le rang « au-dessus », et le compagnon se retrouvait alors CACHÉ
   * derrière le terminal, visible seulement là où aucune fenêtre ne le recouvrait.
   */
  private applyOverlayFlags(): void {
    this.window.setIgnoreMouseEvents(true);
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
    this.applyOverlayFlags();

    const after = this.window.getBounds();
    const geometrie = `${String(after.width)}x${String(after.height)}@${String(after.x)},${String(after.y)}`;
    console.log(`[perch] surface ${geometrie} (${reason})`);
  }

  get origin(): Rect {
    return this.bounds;
  }

  /** Message volatil : perdu si la page n'est pas prête, et c'est sans importance. */
  send(channel: string, payload: unknown): void {
    if (this.window.isDestroyed()) return;
    this.window.webContents.send(channel, payload);
  }

  /**
   * Message dont la perte se verrait : il est conservé et rejoué à chaque chargement.
   *
   * Réservé à ce qui n'est émis qu'à de rares occasions. Une frame perdue est remplacée
   * seize millisecondes plus tard ; une apparence perdue ne revient qu'à l'évolution
   * suivante.
   */
  retain(channel: string, payload: unknown, keep: unknown = payload): void {
    // `keep` peut différer de ce qui part maintenant : une évolution est un ÉVÉNEMENT,
    // son message porte donc une mise en scène qu'il ne faut surtout pas rejouer à chaque
    // rechargement de page. Ce qu'on conserve décrit l'apparence, pas ce qui l'a amenée.
    this.retained.set(channel, keep);
    if (this.loaded) this.send(channel, payload);
  }

  destroy(): void {
    clearInterval(this.rang);
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
