#!/usr/bin/env node
//
// Lancement d'Electron, avec les drapeaux qui conviennent à la plateforme.
//
// `--ozone-platform=x11` était écrit en dur dans le script npm : indispensable sur Linux
// — sans lui l'application tourne en client Wayland natif où `setBounds` et
// `setAlwaysOnTop` sont ignorés en silence, et où RIEN ne s'affiche — mais dépourvu de
// sens sur Windows et sur macOS, que ce projet vise aussi.
//
// Le drapeau doit passer par la LIGNE DE COMMANDE : `app.commandLine.appendSwitch` arrive
// trop tard, Electron ayant déjà choisi sa plateforme d'affichage.
import { spawn } from 'node:child_process';

import electron from 'electron';

const drapeaux = process.platform === 'linux' ? ['--ozone-platform=x11'] : [];
const enfant = spawn(electron, ['.', ...drapeaux, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

enfant.on('exit', (code, signal) => {
  // Un signal n'est pas un code de sortie : le relayer en 0 ferait passer un arrêt forcé
  // pour un succès.
  process.exit(signal === null ? (code ?? 0) : 1);
});
