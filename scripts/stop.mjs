// Arrête le compagnon sans dépendre du clavier, de la souris ni du compositeur.
//
// Le raccourci global ne fonctionne pas sous Wayland — `globalShortcut.register()` y
// renvoie `true` et ne se déclenche jamais. Cette commande est la sortie de secours
// fiable, et la seule qui marche encore si l'overlay se remet à capter les clics.
//
// ⚠️ Le calcul du chemin doit rester IDENTIQUE à packages/app/src/main/pidfile.ts.
// Il n'est pas importé à dessein : ce script doit fonctionner sans `dist/`.
import { readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';

const base = process.env.XDG_RUNTIME_DIR ?? `${homedir()}/.cache`;
const pidPath = `${base}/perch/perch.pid`;

let pid;
try {
  pid = Number((await readFile(pidPath, 'utf8')).trim());
} catch {
  console.log(`Aucun fichier PID dans ${pidPath} — le compagnon ne tourne probablement pas.`);
  process.exit(0);
}

if (!Number.isInteger(pid) || pid <= 0) {
  console.error(`Fichier PID illisible : ${pidPath}`);
  process.exit(1);
}

try {
  process.kill(pid, 'SIGTERM');
  console.log(`Signal envoye au pid ${pid}.`);
} catch (error) {
  if (error.code === 'ESRCH') {
    console.log(`Le pid ${pid} ne tourne plus. Nettoyage du fichier.`);
    await rm(pidPath, { force: true });
    process.exit(0);
  }
  throw error;
}
