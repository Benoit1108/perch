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
  'settings.saved': 'Enregistré.',
  'settings.refused': 'Refusé : {reason}',

  'speech.levelUp': 'Niveau {level} !',
  'speech.evolved': 'Je deviens {name} !',
  'speech.questDone': 'Quête accomplie !',
  'speech.greetMorning': 'Bonjour.',
  'speech.idle': 'Tu es toujours là ?',
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
  'settings.saved': 'Saved.',
  'settings.refused': 'Refused: {reason}',

  'speech.levelUp': 'Level {level}!',
  'speech.evolved': "I'm becoming {name}!",
  'speech.questDone': 'Quest complete!',
  'speech.greetMorning': 'Morning.',
  'speech.idle': 'Still there?',
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
