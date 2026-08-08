'use client';
import { useRef, useEffect } from 'react';

const CATS = [
  {
    id: 'smileys', icon: '😊', label: 'وجوه',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😇','😊','🥹','🥰','😍','🤩','😘','😗','😙','😚','🤗','🤭','🫢','🤫','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','😔','😪','😴','😷','🤒','🤕','🥵','🥶','🤯','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😤','🤑'],
  },
  {
    id: 'hands', icon: '👋', label: 'أيدي',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤲','🫶','🙏','✍️','💪','🫱','🫲','🫳','🫴'],
  },
  {
    id: 'hearts', icon: '❤️', label: 'قلوب',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕','💞','💓','💗','💖','💝','💘','💟','❣️','💔','❤️‍🔥','❤️‍🩹'],
  },
  {
    id: 'nature', icon: '🌿', label: 'طبيعة',
    emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🌿','🍀','🌱','🌲','🌳','🌴','🌵','🌾','🍃','🍂','🍁','🌙','⭐','🌟','💫','✨','⚡','🌈','☀️','🌤️','⛅','🌥️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','🌊','💧','🔥','🌞','🌝','🌛','🌚','🌕','☁️','🌬️','🌪️','🌫️'],
  },
  {
    id: 'animals', icon: '🐱', label: 'حيوانات',
    emojis: ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐴','🦒','🦓','🐘','🦏','🦛','🐪','🐫','🦘','🦬','🐇','🦔','🐬','🐳','🦈','🐟','🦋','🐝','🦜','🕊️','🦅','🦆','🦉','🦚','🐓','🦢','🦩','🐢','🐸','🐊','🦎'],
  },
  {
    id: 'food', icon: '🍎', label: 'طعام',
    emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🥦','🥕','🌽','🍞','🥐','🥖','🥗','🍜','🍛','🍲','🥘','🍕','🌮','🌯','🥙','🍳','🥚','🥞','🧆','🍖','🍗','🍱','🍣','🍘','🍙','🍚','🎂','🍰','🧁','🍩','🍪','🍫','🍬','🍭','☕','🍵','🫖','🧃','🥤','🧋','💧'],
  },
  {
    id: 'sports', icon: '⚽', label: 'رياضة',
    emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','🥋','🎯','🏊','🏄','🚣','🧗','🚴','🏋️','⛹️','🏇','🛹','⛷️','🏂','🪂','🏆','🥇','🥈','🥉','🏅','🎖️'],
  },
  {
    id: 'people', icon: '🧕', label: 'أشخاص',
    emojis: ['🧕','👳','🧔','👴','👵','👶','🧒','👦','👧','🧑','👨‍⚕️','👨‍🎓','👨‍🏫','👨‍💻','👨‍🍳','👨‍🔬','👨‍🌾','👨‍🚒','👨‍✈️','👨‍🚀','🧑‍🦯','🧑‍🦽','🧑‍🦼','🤰','🧑‍🍼'],
  },
  {
    id: 'islamic', icon: '🕌', label: 'إسلاميات',
    emojis: ['🕌','🕋','📿','☪️','🌙','⭐','🕊️','📖','🌹','🤲','🙏','🌸','💚','🫶','🤍'],
  },
  {
    id: 'symbols', icon: '✅', label: 'رموز',
    emojis: ['✅','❌','❓','❗','‼️','⁉️','💯','🔥','⭐','💥','💬','📢','📣','🔔','🔕','📱','💻','📚','📝','✏️','🖊️','🎁','🎉','🎊','🎈','🏠','🚗','✈️','🚀','📷','🎥','🔍','💡','🔑','🔒','🔓','⌚','⌛','⏳','📅','📆','☎️','📞','📧','💰','🏅','🆗','🆒','🆕','➕','➖','✖️','🌟'],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function TareeqEmojiPicker({ onSelect, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<string>(CATS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function scrollToCategory(catId: string) {
    const el = scrollRef.current?.querySelector(`[data-cat="${catId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden shadow-2xl z-50"
      style={{
        background: 'var(--tr-surface)',
        border: '1px solid var(--tr-border-soft)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        maxHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Category tabs */}
      <div
        className="flex gap-1 px-2 py-1.5 overflow-x-auto shrink-0"
        style={{ borderBottom: '1px solid var(--tr-border-subtle)', scrollbarWidth: 'none' }}
      >
        {CATS.map(cat => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-lg transition hover:scale-110"
            style={{ background: 'var(--tr-overlay)' }}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 px-2 py-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--tr-border-soft) transparent' }}
      >
        {CATS.map(cat => (
          <div key={cat.id} data-cat={cat.id} className="mb-3">
            <p className="text-[10px] font-bold mb-1.5 px-1" style={{ color: 'var(--tr-text-muted)' }}>{cat.label}</p>
            <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))' }}>
              {cat.emojis.map((em, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(em); }}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-xl transition hover:scale-110 active:scale-95"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
