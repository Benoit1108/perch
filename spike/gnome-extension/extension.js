// Perch — extension de capteurs (spike S0).
//
// INVARIANT I2 : capteurs uniquement, zéro logique de jeu. Ce fichier tourne dans le
// processus de GNOME Shell — un throw non rattrapé ici peut emporter la session.
// Toute méthode exposée doit donc être défensive et sans état.

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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

class SensorsService {
    /** @returns {[number, number]} position globale du curseur */
    GetPointer() {
        const [x, y] = global.get_pointer();
        return [x, y];
    }

    /**
     * Rectangles des fenêtres normales et visibles, dans l'espace global.
     * On filtre sur NORMAL : les docks, panneaux et menus ne sont pas des
     * surfaces sur lesquelles un pet doit pouvoir se percher.
     */
    GetWindows() {
        const out = [];
        for (const actor of global.get_window_actors()) {
            const win = actor.meta_window;
            if (win === null) continue;
            if (win.get_window_type() !== Meta.WindowType.NORMAL) continue;
            if (win.minimized) continue;
            const r = win.get_frame_rect();
            out.push([r.x, r.y, r.width, r.height]);
        }
        return out;
    }

    /** Géométrie de chaque écran — c'est elle qui définit les zones vides. */
    GetMonitors() {
        const out = [];
        const n = global.display.get_n_monitors();
        for (let i = 0; i < n; i++) {
            const r = global.display.get_monitor_geometry(i);
            out.push([r.x, r.y, r.width, r.height]);
        }
        return out;
    }
}

export default class PerchSensorsExtension extends Extension {
    enable() {
        this._service = new SensorsService();
        this._exported = Gio.DBusExportedObject.wrapJSObject(IFACE_XML, this._service);
        this._exported.export(Gio.DBus.session, OBJECT_PATH);
        this._ownerId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            BUS_NAME,
            Gio.BusNameOwnerFlags.NONE,
            null,
            null,
            null
        );
    }

    disable() {
        if (this._ownerId !== undefined) {
            Gio.bus_unown_name(this._ownerId);
            this._ownerId = undefined;
        }
        if (this._exported !== undefined) {
            this._exported.unexport();
            this._exported = undefined;
        }
        this._service = undefined;
    }
}
