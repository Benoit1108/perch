import { describe, expect, it } from 'vitest';

import { electronSeesDesktop } from './platform.js';

describe('electronSeesDesktop', () => {
  it('fait confiance à Windows et à macOS', () => {
    expect(electronSeesDesktop({ os: 'win32', sessionType: undefined })).toBe(true);
    expect(electronSeesDesktop({ os: 'darwin', sessionType: undefined })).toBe(true);
  });

  it('fait confiance à une vraie session X11', () => {
    expect(electronSeesDesktop({ os: 'linux', sessionType: 'x11' })).toBe(true);
  });

  // Mesuré : sous XWayland le curseur est figé et l'inactivité toujours nulle. Les deux
  // sont des réponses fausses, pas des absences de réponse.
  it('ne fait pas confiance à Wayland', () => {
    expect(electronSeesDesktop({ os: 'linux', sessionType: 'wayland' })).toBe(false);
  });

  // Un Linux sans `XDG_SESSION_TYPE` — session lancée à la main, conteneur — est traité
  // comme un X11 ordinaire : c'est le cas de loin le plus fréquent, et l'extension GNOME
  // reste essayée en premier de toute façon.
  it('traite un Linux sans type de session comme X11', () => {
    expect(electronSeesDesktop({ os: 'linux', sessionType: undefined })).toBe(true);
  });
});
