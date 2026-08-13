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

  'speech.levelUp': 'Niveau {level} !',
  'speech.questDone': 'Quête accomplie !',
  'speech.greetMorning': 'Bonjour.',
  'speech.idle': 'Tu es toujours là ?',
  'speech.grabbed': 'Hé !',
  'speech.dropped': 'Ouf.',
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

  'speech.levelUp': 'Level {level}!',
  'speech.questDone': 'Quest complete!',
  'speech.greetMorning': 'Morning.',
  'speech.idle': 'Still there?',
  'speech.grabbed': 'Hey!',
  'speech.dropped': 'Phew.',
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
