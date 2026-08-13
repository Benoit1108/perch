// tsc ne recopie que du TypeScript compilé. Le HTML de l'overlay et le préchargement en
// CommonJS sont des ressources : sans cette étape, `dist/` contient un process principal
// qui charge une page inexistante.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', 'src', 'renderer');
const to = join(here, '..', 'dist', 'renderer');

await mkdir(to, { recursive: true });

const assets = (await readdir(from)).filter((name) => /\.(html|cjs|css)$/.test(name));
await Promise.all(assets.map((name) => copyFile(join(from, name), join(to, name))));

console.log(`renderer : ${assets.length} ressource(s) copiee(s) dans dist/`);
