// Fenêtre de réglages.
//
// Les libellés viennent du catalogue par IPC, jamais du HTML (invariant I8). Les listes
// sont construites NŒUD PAR NŒUD : elles affichent des chemins de dépôts et des libellés
// de tâches, c'est-à-dire du texte écrit par l'utilisateur, qu'un assemblage de chaînes
// HTML interpréterait.
(() => {
  'use strict';

  const par = (id) => document.getElementById(id);
  const ETAT_MS = 2500;

  let config = null;
  let textes = {};

  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const dire = (cle, params = {}) =>
    Object.entries(params).reduce(
      (texte, [nom, valeur]) => texte.replaceAll(`{${nom}}`, valeur),
      textes[cle] ?? ''
    );

  function poserLibelles() {
    for (const noeud of document.querySelectorAll('[data-texte]')) {
      noeud.textContent = dire(noeud.dataset.texte);
    }
    par('nouvelle').placeholder = dire('newTask');
  }

  /** Une ligne de liste : un contenu, et le bouton qui la retire. */
  function ligne(contenu, action) {
    const item = document.createElement('li');
    item.append(...contenu);

    const bouton = document.createElement('button');
    bouton.className = 'retirer';
    bouton.type = 'button';
    bouton.textContent = dire('remove');
    bouton.addEventListener('click', action);
    item.append(bouton);

    return item;
  }

  function vide(message) {
    const item = document.createElement('li');
    const texte = document.createElement('span');
    texte.className = 'chemin';
    texte.textContent = message;
    item.append(texte);
    return item;
  }

  function texteSimple(valeur, classe) {
    const noeud = document.createElement('span');
    if (classe) noeud.className = classe;
    noeud.textContent = valeur;
    return noeud;
  }

  function rendreDepots() {
    const liste = par('depots');
    liste.replaceChildren();

    if (config.repos.length === 0) {
      liste.append(vide(dire('noRepos')));
      return;
    }

    for (const [index, repo] of config.repos.entries()) {
      liste.append(
        ligne([texteSimple(repo, 'chemin')], () => {
          config.repos = config.repos.filter((_, rang) => rang !== index);
          void appliquer();
        })
      );
    }
  }

  function rendreTaches() {
    const liste = par('taches');
    liste.replaceChildren();

    if (config.tasks.length === 0) {
      liste.append(vide(dire('noTasks')));
      return;
    }

    for (const [index, tache] of config.tasks.entries()) {
      const fait = tache.doneOn === aujourdhui();

      const case_ = document.createElement('input');
      case_.type = 'checkbox';
      case_.checked = fait;
      case_.addEventListener('change', () => {
        const doneOn = case_.checked ? aujourdhui() : null;
        config.tasks = config.tasks.map((t, rang) => (rang === index ? { ...t, doneOn } : t));
        void appliquer();
      });

      liste.append(
        ligne([case_, texteSimple(tache.label, fait ? 'fait' : '')], () => {
          config.tasks = config.tasks.filter((_, rang) => rang !== index);
          void appliquer();
        })
      );
    }
  }

  /** Une créature qui attend dans la boîte, et le bouton qui l'adopte. */
  function attente(enveloppe) {
    const item = document.createElement('li');
    const quoi = `${enveloppe.creature.name} — niv. ${enveloppe.creature.level}`;
    item.append(texteSimple(`${quoi} (${enveloppe.origin.app})`, 'chemin'));

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.textContent = dire('withdraw');
    bouton.addEventListener('click', () => {
      void adopter(enveloppe.id);
    });
    item.append(bouton);

    return item;
  }

  async function rendreBoite() {
    const liste = par('boite');
    const attentes = await window.perchSettings.box();

    liste.replaceChildren();
    if (attentes.length === 0) {
      liste.append(vide(dire('boxEmpty')));
      return;
    }
    liste.append(...attentes.map(attente));
  }

  /** Affiche un message le temps qu'on le lise, puis s'efface. */
  function annoncer(message) {
    par('etat').textContent = message;
    setTimeout(() => {
      par('etat').textContent = '';
    }, ETAT_MS);
  }

  async function adopter(id) {
    const issue = await window.perchSettings.withdraw(id);
    const messages = {
      adoptee: () => dire('adopted', { level: issue.level }),
      inconnue: () => dire('unknownSpecies', { species: issue.species }),
      partie: () => dire('gone'),
    };

    annoncer((messages[issue.kind] ?? (() => ''))());
    await rendreBoite();
  }

  async function deposer() {
    const issue = await window.perchSettings.deposit();
    annoncer(
      issue.kind === 'depose' ? dire('depositDone', { name: issue.name }) : dire('depositRefused')
    );
    await rendreBoite();
  }

  function rendre() {
    par('locale').value = config.locale ?? '';
    par('prive').checked = config.privateMode;
    rendreDepots();
    rendreTaches();
  }

  async function appliquer() {
    rendre();
    const reponse = await window.perchSettings.write(config);

    annoncer(reponse.ok ? dire('saved') : dire('refused', { reason: reponse.error }));
  }

  function ajouterTache() {
    const champ = par('nouvelle');
    const label = champ.value.trim();
    if (label === '') return;

    config.tasks = [
      ...config.tasks,
      { id: `${Date.now()}-${config.tasks.length}`, label, doneOn: null },
    ];
    champ.value = '';
    void appliquer();
  }

  par('compagnon').addEventListener('click', () => {
    // N'écrit rien : ce bouton ouvre une fenêtre. Le passer par `appliquer` réécrirait le
    // fichier de configuration pour rien.
    void window.perchSettings.chooseCompanion();
  });

  par('ajouter').addEventListener('click', ajouterTache);
  par('deposer').addEventListener('click', () => {
    void deposer();
  });
  par('locale').addEventListener('change', (event) => {
    config.locale = event.target.value === '' ? null : event.target.value;
    // Les libellés sont retraduits sur-le-champ : changer de langue dans une fenêtre qui
    // reste dans l'ancienne donnerait l'impression que le réglage n'a pas pris.
    void appliquer().then(recharger);
  });
  par('prive').addEventListener('change', (event) => {
    config.privateMode = event.target.checked;
    void appliquer();
  });

  async function recharger() {
    textes = await window.perchSettings.texts();
    poserLibelles();
    if (config !== null) rendre();
  }

  void (async () => {
    config = await window.perchSettings.read();
    await recharger();
    await rendreBoite();
  })();
})();
