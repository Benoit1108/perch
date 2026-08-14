// Fusibles Electron : on retire ce dont l'application n'a aucun usage.
//
// Ces interrupteurs sont gravés dans le binaire à la construction. Ils ne protègent pas
// d'un attaquant qui contrôle déjà la machine, mais ils ferment les portes les plus
// commodes pour détourner une application installée : injecter du code par une variable
// d'environnement, ou l'ouvrir comme un simple interpréteur Node.
//
// En CommonJS : electron-builder charge ce hook avec `require`.
const { FuseVersion, FuseV1Options, flipFuses } = require('@electron/fuses');
const path = require('node:path');

/**
 * Chemin du binaire selon la plateforme empaquetée.
 *
 * Le nom diffère d'un système à l'autre : Windows et macOS reprennent le nom du produit,
 * Linux celui de l'exécutable — qui, faute de `executableName`, héritait de celui du
 * paquet npm et donnait un fichier appelé « @perchapp ».
 */
function binaire(contexte) {
  const produit = contexte.packager.appInfo.productFilename;

  if (contexte.electronPlatformName === 'win32') {
    return path.join(contexte.appOutDir, `${produit}.exe`);
  }
  if (contexte.electronPlatformName === 'darwin') {
    return path.join(contexte.appOutDir, `${produit}.app`);
  }
  return path.join(contexte.appOutDir, contexte.packager.executableName);
}

exports.default = async function fusibles(contexte) {
  await flipFuses(binaire(contexte), {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: contexte.electronPlatformName === 'darwin',

    // `ELECTRON_RUN_AS_NODE` transforme l'exécutable en interpréteur Node : une aubaine
    // pour faire exécuter n'importe quoi sous l'identité de l'application installée.
    [FuseV1Options.RunAsNode]: false,

    // Le cookie de chiffrement par défaut est public. Nous ne stockons rien avec, mais
    // laisser l'interface ouverte donne l'illusion inverse.
    [FuseV1Options.EnableCookieEncryption]: true,

    // Deux variables d'environnement qui injectent du code au démarrage. Aucune n'est
    // utilisée ici.
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Vérifie que l'archive de l'application n'a pas été modifiée après l'installation.
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};
