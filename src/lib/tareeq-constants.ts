export const TAREEQ_CATEGORIES = {
  experience: { ar: 'تجربة', en: 'Experience' },
  story:      { ar: 'قصة',   en: 'Story' },
  idea:       { ar: 'فكرة',  en: 'Idea' },
  question:   { ar: 'سؤال',  en: 'Question' },
  project:    { ar: 'مشروع', en: 'Project' },
  reflection: { ar: 'تأمل',  en: 'Reflection' },
} as const;

export type TareeqCategoryKey = keyof typeof TAREEQ_CATEGORIES;

// Map any display label (AR or EN) → canonical key stored in DB
export const CATEGORY_KEY: Record<string, TareeqCategoryKey> = {
  تجربة: 'experience', Experience: 'experience',
  قصة:   'story',      Story:      'story',
  فكرة:  'idea',       Idea:       'idea',
  سؤال:  'question',   Question:   'question',
  مشروع: 'project',    Project:    'project',
  تأمل:  'reflection', Reflection: 'reflection',
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
