export const TAREEQ_CATEGORIES = {
  experience: { ar: 'تجربة', en: 'Experience' },
  story:      { ar: 'قصة',   en: 'Story' },
  idea:       { ar: 'فكرة',  en: 'Idea' },
  question:   { ar: 'سؤال',  en: 'Question' },
  project:    { ar: 'مشروع', en: 'Project' },
  reflection: { ar: 'تأمل',  en: 'Reflection' },
} as const;

export type TareeqCategoryKey = keyof typeof TAREEQ_CATEGORIES;

// Map any display label (AR or EN) OR canonical key → canonical key stored in DB
export const CATEGORY_KEY: Record<string, TareeqCategoryKey> = {
  // canonical keys (pass-through — modal sends these directly)
  experience: 'experience', story: 'story', idea: 'idea',
  question:   'question',   project: 'project', reflection: 'reflection',
  // Arabic display labels
  تجربة: 'experience', قصة: 'story', فكرة: 'idea',
  سؤال:  'question',   مشروع: 'project', تأمل: 'reflection',
  // English display labels
  Experience: 'experience', Story: 'story', Idea: 'idea',
  Question:   'question',   Project: 'project', Reflection: 'reflection',
};

export const CATEGORY_ICONS: Record<string, string> = {
  experience: '✨',
  story:      '📖',
  idea:       '💡',
  question:   '❓',
  project:    '🚀',
  reflection: '🌙',
};

export const CATEGORY_COLORS: Record<string, string> = {
  experience: 'bg-amber-100 text-amber-700',
  story:      'bg-purple-100 text-purple-700',
  idea:       'bg-blue-100 text-blue-700',
  question:   'bg-green-100 text-green-700',
  project:    'bg-orange-100 text-orange-700',
  reflection: 'bg-rose-100 text-rose-700',
};
