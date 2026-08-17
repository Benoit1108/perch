// Choix du compagnon.
//
// Les cartes sont construites NŒUD PAR NŒUD : les noms viennent d'un manifeste ou d'un
// catalogue, donc d'une donnée qu'on n'a pas écrite. `textContent` ne peut rien interpréter.
(() => {
  'use strict';

  const par = (id) => document.getElementById(id);
  /** Le temps qu'on laisse à quelqu'un de finir son mot avant de chercher. */
  const REPIT_MS = 160;

  let textes = {};

  function portrait(choix) {
    if (!choix.portrait) {
      const marque = document.createElement('div');
      marque.className = 'vide';
      return marque;
    }

    const image = document.createElement('img');
    image.src = choix.portrait;
    image.alt = '';
    return image;
  }

  function carte(choix) {
    const bouton = document.createElement('button');
    bouton.className = 'choix';
    bouton.type = 'button';

    const nom = document.createElement('span');
    nom.className = 'nom';
    nom.textContent = choix.name;

    bouton.append(portrait(choix), nom);
    bouton.addEventListener('click', () => {
      void window.perchChooser.pick({ packId: choix.packId, lineId: choix.lineId });
    });

    return bouton;
  }

  /**
   * Une créature du catalogue : son nom, et ce qu'elle deviendra.
   *
   * La lignée est montrée AVANT le choix — c'est la seule façon de comprendre qu'on adopte
   * un Fantominus quand on a cherché « Ectoplasma », et que l'évolution viendra plus tard.
   */
  function ligne(suggestion) {
    const bouton = document.createElement('button');
    bouton.className = 'suggestion';
    bouton.type = 'button';

    const nom = document.createElement('span');
    nom.className = 'nom';
    nom.textContent = suggestion.name;

    const suite = document.createElement('span');
    suite.className = 'lignee';
    suite.textContent = suggestion.line.join(' → ');

    bouton.append(nom, suite);
    bouton.addEventListener('click', () => {
      void adopter(suggestion.familyId);
    });

    return bouton;
  }

  /** Un message d'état sous le champ, ou rien. */
  function dire(message) {
    par('etat').textContent = message ?? '';
    par('etat').hidden = !message;
  }

  async function adopter(familyId) {
    // Les images arrivent du réseau : sans ce message, la fenêtre a l'air figée pendant
    // le téléchargement, et on reclique.
    document.body.classList.add('occupe');
    dire(textes.searchBusy);

    const reponse = await window.perchChooser.adopt(familyId);

    // En cas de succès la fenêtre se ferme d'elle-même ; il n'y a rien à réactiver.
    if (!reponse || !reponse.ok) {
      document.body.classList.remove('occupe');
      dire(textes.searchFailed);
    }
  }

  /**
   * Une SEULE liste à l'écran.
   *
   * Les créatures installées et les résultats se remplacent au lieu de s'empiler : les
   * deux à la fois font une page de neuf cents pixels, et la première recherche tombait
   * sous le bord de la fenêtre — mesuré en capturant la vraie fenêtre.
   */
  function montrer(cherche) {
    par('titre-installees').hidden = cherche;
    par('grille').hidden = cherche;
    par('vide').hidden = cherche || par('grille').children.length > 0;
    par('resultats').hidden = !cherche;
  }

  async function chercher(recherche) {
    const cherche = recherche.trim() !== '';
    const trouvees = cherche ? await window.perchChooser.search(recherche) : [];

    par('resultats').replaceChildren(...trouvees.map(ligne));
    montrer(cherche);
    dire(cherche && trouvees.length === 0 ? textes.searchNone : null);
  }

  function brancherRecherche() {
    const champ = par('recherche');
    champ.placeholder = textes.searchPlaceholder;

    let attente = null;
    champ.addEventListener('input', () => {
      // Chercher à chaque touche traverserait le pont pour rien : on attend la fin du mot.
      if (attente !== null) clearTimeout(attente);
      attente = setTimeout(() => void chercher(champ.value), REPIT_MS);
    });
  }

  void (async () => {
    const offre = await window.perchChooser.offer();
    textes = offre.labels;

    document.title = textes.title;
    par('titre').textContent = textes.title;
    par('intro').textContent = textes.intro;
    par('titre-installees').textContent = textes.installed;
    par('aide-recherche').textContent = textes.searchHint;

    par('vide').textContent = textes.empty;
    par('grille').append(...offre.choices.map(carte));
    montrer(false);

    brancherRecherche();
  })();
})();
