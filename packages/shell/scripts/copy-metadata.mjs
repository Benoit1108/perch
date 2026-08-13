// GNOME ne charge une extension que si `metadata.json` se trouve à côté de son
// `extension.js`. tsc ne recopie pas les fichiers non-TypeScript : sans cette étape,
// `dist/` contient un extension.js que le compositeur ignorera silencieusement.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

await mkdir(dist, { recursive: true });
await copyFile(join(here, '..', 'src', 'metadata.json'), join(dist, 'metadata.json'));

console.log('metadata.json copie dans dist/');
