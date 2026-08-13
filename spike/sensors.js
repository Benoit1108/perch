// Deux backends de capteurs, sélectionnés à chaud.
//
//   gnome            → extension GNOME via D-Bus. Voit TOUT (curseur global,
//                      fenêtres Wayland natives, écrans). Exige que l'extension
//                      soit chargée, donc une reconnexion de session.
//   electron-xwayland → repli. Electron sous XWayland sait lire le curseur global,
//                      mais ne voit aucune fenêtre. C'est le « niveau 1 dégradé »
//                      du cadrage — l'objet de ce spike est de savoir s'il tient.

const BUS_NAME = 'org.perch.Sensors';
const OBJECT_PATH = '/org/perch/Sensors';

const toRect = ([x, y, width, height]) => ({ x, y, width, height });

async function createGnomeSensors() {
  const dbus = require('dbus-next');
  const bus = dbus.sessionBus();
  const proxy = await bus.getProxyObject(BUS_NAME, OBJECT_PATH);
  const iface = proxy.getInterface(BUS_NAME);

  // Un premier appel sert de test de vie : si l'extension n'est pas chargée,
  // il échoue ici et on bascule sur le repli.
  await iface.GetPointer();

  return {
    name: 'gnome',
    seesWindows: true,
    async pointer() {
      const [x, y] = await iface.GetPointer();
      return { x, y };
    },
    async windows() {
      return (await iface.GetWindows()).map(toRect);
    },
    async monitors() {
      return (await iface.GetMonitors()).map(toRect);
    },
  };
}

function createElectronSensors(screen) {
  return {
    name: 'electron-xwayland',
    seesWindows: false,
    async pointer() {
      const p = screen.getCursorScreenPoint();
      return { x: p.x, y: p.y };
    },
    async windows() {
      return [];
    },
    async monitors() {
      return screen.getAllDisplays().map((d) => ({ ...d.bounds }));
    },
  };
}

async function createSensors(screen) {
  try {
    const gnome = await createGnomeSensors();
    console.log('[perch] capteurs : extension GNOME (complet)');
    return gnome;
  } catch (err) {
    console.log(`[perch] extension GNOME indisponible (${err.message})`);
    console.log('[perch] capteurs : repli XWayland (degrade, sans fenetres)');
    return createElectronSensors(screen);
  }
}

module.exports = { createSensors };
