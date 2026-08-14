// Choix du compagnon.
//
// Les cartes sont construites NŒUD PAR NŒUD : les noms viennent d'un manifeste, donc
// d'une donnée qu'on n'a pas écrite. `textContent` ne peut rien interpréter.
(() => {
  'use strict';

  const par = (id) => document.getElementById(id);

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

  void (async () => {
    const offre = await window.perchChooser.offer();

    document.title = offre.title;
    par('titre').textContent = offre.title;
    par('intro').textContent = offre.intro;

    if (offre.choices.length === 0) {
      par('vide').textContent = offre.empty;
      par('vide').hidden = false;
      return;
    }

    par('grille').append(...offre.choices.map(carte));
  })();
})();
