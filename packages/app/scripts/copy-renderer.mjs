// tsc ne recopie que du TypeScript compilé. Les pages, leurs feuilles de style, leurs
// scripts et les préchargements en CommonJS sont des ressources : sans cette étape,
// `dist/` contient un process principal qui charge une page inexistante — ou pire, une
// page sans style ni comportement, qui s'affiche mais ne fait rien.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', 'src', 'renderer');
const to = join(here, '..', 'dist', 'renderer');

await mkdir(to, { recursive: true });

const assets = (await readdir(from)).filter((name) => /\.(html|css|js|cjs)$/.test(name));
await Promise.all(assets.map((name) => copyFile(join(from, name), join(to, name))));

console.log(`renderer : ${assets.length} ressource(s) copiee(s) dans dist/`);
