import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Extension de capteurs.
 *
 * INVARIANT I2 — capteurs uniquement, zéro logique de jeu. Ce code tourne DANS le
 * processus de GNOME Shell : une exception non rattrapée ici peut emporter la session
 * de l'utilisateur. Toute méthode exposée doit rester défensive et sans état.
 *
 * Elle est indispensable sur Wayland : mesuré en S0, laisser passer les clics coupe la
 * seule source de position du curseur dont dispose XWayland (spike/README.md, 7 ter).
 * `global.get_pointer()` interroge le compositeur, qui connaît toujours la vraie position.
 *
 * Chaque méthode exposée est enveloppée dans un `try/catch` : GJS convertirait bien une
 * exception en erreur D-Bus, mais on préfère rendre une réponse dégradée exploitable
 * plutôt que de faire échouer l'appel — et le commentaire ci-dessus doit correspondre au
 * code, pas exprimer une intention.
 */

const BUS_NAME = 'org.perch.Sensors';
const OBJECT_PATH = '/org/perch/Sensors';

const IFACE_XML = `
<node>
  <interface name="org.perch.Sensors">
    <method name="GetPointer">
      <arg type="i" direction="out" name="x"/>
      <arg type="i" direction="out" name="y"/>
    </method>
    <method name="GetWindows">
      <arg type="a(iiii)" direction="out" name="windows"/>
    </method>
    <method name="GetMonitors">
      <arg type="a(iiii)" direction="out" name="monitors"/>
    </method>
  </interface>
</node>`;

type RectTuple = [number, number, number, number];

/**
 * `logError` de GJS attend un objet. Une valeur levée peut être n'importe quoi, et
 * c'est précisément dans ce cas de bord qu'on ne veut pas d'une seconde exception —
 * celle-ci partirait depuis le processus du compositeur.
 */
function report(error: unknown, context: string): void {
  if (typeof error === 'object' && error !== null) {
    logError(error, context);
  } else {
    log(`${context}: ${String(error)}`);
  }
}

class SensorsService {
  /** Position globale du curseur. `[0, 0]` si le compositeur ne répond pas. */
  GetPointer(): [number, number] {
    try {
      const [x, y] = global.get_pointer();
      return [x, y];
    } catch (error: unknown) {
      report(error, 'perch: GetPointer');
      return [0, 0];
    }
  }

  /**
   * Rectangles des fenêtres normales et visibles.
   *
   * On filtre sur NORMAL : docks, panneaux et menus ne sont pas des surfaces sur
   * lesquelles un compagnon doit pouvoir se percher.
   */
  GetWindows(): RectTuple[] {
    const out: RectTuple[] = [];

    try {
      for (const actor of global.get_window_actors()) {
        const win = actor.meta_window;
        if (win === null) continue;
        if (win.get_window_type() !== Meta.WindowType.NORMAL) continue;
        if (win.minimized) continue;

        const r = win.get_frame_rect();
        out.push([r.x, r.y, r.width, r.height]);
      }
    } catch (error: unknown) {
      report(error, 'perch: GetWindows');
    }

    return out;
  }

  /** Géométrie de chaque écran : c'est elle qui définit les zones vides du bureau. */
  GetMonitors(): RectTuple[] {
    const out: RectTuple[] = [];

    try {
      const count = global.display.get_n_monitors();
      for (let i = 0; i < count; i++) {
        const r = global.display.get_monitor_geometry(i);
        out.push([r.x, r.y, r.width, r.height]);
      }
    } catch (error: unknown) {
      report(error, 'perch: GetMonitors');
    }

    return out;
  }
}

export default class PerchSensorsExtension extends Extension {
  private exported: Gio.DBusExportedObject | undefined;
  private ownerId: number | undefined;

  override enable(): void {
    this.exported = Gio.DBusExportedObject.wrapJSObject(IFACE_XML, new SensorsService());
    this.exported.export(Gio.DBus.session, OBJECT_PATH);
    this.ownerId = Gio.bus_own_name(
      Gio.BusType.SESSION,
      BUS_NAME,
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
      null
    );
  }

  override disable(): void {
    if (this.ownerId !== undefined) {
      Gio.bus_unown_name(this.ownerId);
      this.ownerId = undefined;
    }
    if (this.exported !== undefined) {
      this.exported.unexport();
      this.exported = undefined;
    }
  }
}
