/**
 * Chaînes d'interface.
 *
 * INVARIANT I8 — aucun texte en dur ailleurs que dans ce dossier. Les modules de logique
 * ne manipulent que des clés ; ce qui s'affiche vit ici, et nulle part ailleurs.
 *
 * Les catalogues sont des modules TypeScript et non des fichiers JSON chargés à
 * l'exécution : `core` n'a pas le droit de lire le disque (invariant I3), et un catalogue
 * embarqué se vérifie à la compilation plutôt qu'au premier affichage.
 */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const fr = {
  'quest.focus2h': 'Deux heures de concentration',
  'quest.active3h': 'Trois heures actives',
  'quest.threeApps': 'Trois applications différentes',
  'quest.oneBreak': 'Prendre une vraie pause',
  'quest.threeCommits': 'Trois commits',
  'quest.oneCommit': 'Un commit',
  'quest.fiveTasks': 'Cinq tâches cochées',

  'chooser.title': 'Choisis ton compagnon',
  'chooser.intro': "Il vivra sur ton bureau et grandira avec toi. Ce choix n'est pas définitif.",
  'chooser.empty': 'Aucune créature installée pour le moment.',
  'chooser.installed': 'Déjà chez toi',
  'chooser.searchHint':
    'Cherche par son nom. Sa lignée entière est téléchargée : il commencera petit et grandira.',
  'chooser.searchPlaceholder': 'Fantominus, Magicarpe, Zekrom…',
  'chooser.searchNone': 'Aucune créature de ce nom.',
  'chooser.searchBusy': 'Téléchargement…',
  'chooser.searchFailed': 'Téléchargement impossible. Vérifie ta connexion, puis réessaie.',
  'chooser.myPack': 'Mes créatures',

  'settings.privacy': 'Tout reste sur cette machine. Aucun compte, aucun serveur.',
  'settings.language': 'Langue',
  'settings.systemLanguage': 'Celle du système',
  'settings.companion': 'Compagnon',
  'settings.changeCompanion': 'Changer de compagnon',
  'settings.companionHelp':
    "L'expérience acquise est conservée : seule l'apparence change, au stade correspondant au niveau déjà atteint.",
  'settings.private': 'Mode privé',
  'settings.privateToggle': 'Suspendre toute mesure',
  'settings.privateHelp':
    "Le compagnon s'endort et cesse de progresser. Aucune activité n'est mesurée tant que la case est cochée.",
  'settings.repos': 'Dépôts surveillés',
  'settings.reposHelp':
    "Ajoutés avec « npm run watch » depuis l'intérieur d'un dépôt. Seuls les identifiants de commit sont lus — jamais un message, un nom de fichier ou un diff.",
  'settings.noRepos': 'Aucun dépôt surveillé.',
  'settings.tasks': 'Tâches du jour',
  'settings.noTasks': 'Aucune tâche.',
  'settings.newTask': 'Ajouter une tâche…',
  'settings.add': 'Ajouter',
  'settings.remove': 'retirer',
  'settings.box': 'Boîte d’échange',
  'settings.boxHelp':
    'Un dossier partagé avec les autres applications compagnon. Y déposer sa créature, c’est la confier ; en retirer une, c’est l’adopter avec son niveau.',
  'settings.boxEmpty': 'Personne n’attend dans la boîte.',
  'settings.deposit': 'Déposer mon compagnon',
  'settings.withdraw': 'Adopter',
  'settings.depositDone': '{name} attend dans la boîte.',
  'settings.depositRefused': 'Cette créature n’a pas d’espèce déclarée : rien à échanger.',
  'settings.adopted': 'Bienvenue ! Vous voilà au niveau {level}.',
  'settings.gone': 'Trop tard : quelqu’un l’a prise avant vous.',
  'settings.unknownSpecies': 'Aucun pack installé ne sait accueillir « {species} ».',
  'settings.saved': 'Enregistré.',
  'settings.refused': 'Refusé : {reason}',

  'speech.levelUp': 'Niveau {level} !',
  'speech.evolved': 'Je deviens {name} !',
  'speech.questDone': 'Quête accomplie !',
  'speech.greetMorning': 'Bonjour.',
  'speech.idle': 'On procrastine ? Je ne juge pas. Un peu.',
  'speech.newScene': 'Tiens, on change de décor.',
  'speech.windowGone': 'Et hop, une fenêtre en moins.',
  'speech.windowNew': 'Encore une ? Tu vas manquer de place.',
  'speech.switched': 'Tu papillonnes.',
  'speech.tired': 'Je souffle deux minutes.',
  'speech.perched': 'Vue imprenable, d’ici.',
  'speech.chatterB': 'Je surveille. Enfin, je regarde.',
  'speech.chatterC': 'Prends ton temps. J’ai le mien.',
  'speech.chatter': 'Belle journée pour travailler.',
  'speech.sleepy': 'Je vais faire un somme…',
} as const;

const en: Record<keyof typeof fr, string> = {
  'quest.focus2h': 'Two hours of focus',
  'quest.active3h': 'Three active hours',
  'quest.threeApps': 'Three different apps',
  'quest.oneBreak': 'Take a real break',
  'quest.threeCommits': 'Three commits',
  'quest.oneCommit': 'One commit',
  'quest.fiveTasks': 'Five tasks done',

  'chooser.title': 'Choose your companion',
  'chooser.intro': 'It will live on your desktop and grow with you. You can change this later.',
  'chooser.empty': 'No creature installed yet.',
  'chooser.installed': 'Already yours',
  'chooser.searchHint':
    'Search by name. The whole family is downloaded: it starts small and grows up.',
  'chooser.searchPlaceholder': 'Gastly, Magikarp, Zekrom…',
  'chooser.searchNone': 'No creature by that name.',
  'chooser.searchBusy': 'Downloading…',
  'chooser.searchFailed': 'Download failed. Check your connection, then try again.',
  'chooser.myPack': 'My creatures',

  'settings.privacy': 'Everything stays on this machine. No account, no server.',
  'settings.language': 'Language',
  'settings.systemLanguage': "The system's",
  'settings.companion': 'Companion',
  'settings.changeCompanion': 'Change companion',
  'settings.companionHelp':
    'Experience is kept: only the appearance changes, to the stage matching the level already reached.',
  'settings.private': 'Private mode',
  'settings.privateToggle': 'Suspend all measurement',
  'settings.privateHelp':
    'The companion falls asleep and stops progressing. No activity is measured while this is ticked.',
  'settings.repos': 'Watched repositories',
  'settings.reposHelp':
    'Added with “npm run watch” from inside a repository. Only commit identifiers are read — never a message, a file name or a diff.',
  'settings.noRepos': 'No repository watched.',
  'settings.tasks': "Today's tasks",
  'settings.noTasks': 'No task.',
  'settings.newTask': 'Add a task…',
  'settings.add': 'Add',
  'settings.remove': 'remove',
  'settings.box': 'Exchange box',
  'settings.boxHelp':
    'A folder shared with other companion apps. Leaving your creature there entrusts it; taking one adopts it, at its level.',
  'settings.boxEmpty': 'Nobody is waiting in the box.',
  'settings.deposit': 'Leave my companion',
  'settings.withdraw': 'Adopt',
  'settings.depositDone': '{name} is waiting in the box.',
  'settings.depositRefused': 'This creature declares no species: nothing to exchange.',
  'settings.adopted': 'Welcome! You are now level {level}.',
  'settings.gone': 'Too late — someone took it first.',
  'settings.unknownSpecies': 'No installed pack can host “{species}”.',
  'settings.saved': 'Saved.',
  'settings.refused': 'Refused: {reason}',

  'speech.levelUp': 'Level {level}!',
  'speech.evolved': "I'm becoming {name}!",
  'speech.questDone': 'Quest complete!',
  'speech.greetMorning': 'Morning.',
  'speech.idle': 'Procrastinating? No judgement. Some.',
  'speech.newScene': 'Oh, a change of scenery.',
  'speech.windowGone': 'And poof — one window fewer.',
  'speech.windowNew': 'Another one? You are running out of room.',
  'speech.switched': 'You do flit about.',
  'speech.tired': 'Resting my wings a moment.',
  'speech.perched': 'Quite the view from up here.',
  'speech.chatterB': 'I am keeping watch. Well, looking.',
  'speech.chatterC': 'Take your time. I have plenty.',
  'speech.chatter': 'Nice day for getting things done.',
  'speech.sleepy': 'Time for a nap…',
};

export type MessageKey = keyof typeof fr;

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { fr, en };

/** Toutes les clés connues. Sert au test de parité entre langues. */
export const MESSAGE_KEYS: readonly MessageKey[] = Object.keys(fr).filter(
  (key): key is MessageKey => key in fr
);

/**
 * Traduit une clé.
 *
 * Les paramètres sont substitués textuellement : `{level}` devient la valeur fournie.
 * Une clé inconnue renvoie la clé elle-même — visible en développement, inoffensif en
 * production, et jamais une page blanche.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Readonly<Record<string, string | number>> = {}
): string {
  const template = CATALOGS[locale][key];

  return Object.entries(params).reduce<string>(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

/** Choisit la langue la plus proche de celle du système, avec repli sur l'anglais. */
export function resolveLocale(preferred: string | undefined): Locale {
  const short = (preferred ?? '').slice(0, 2).toLowerCase();
  return LOCALES.find((locale) => locale === short) ?? 'en';
}
