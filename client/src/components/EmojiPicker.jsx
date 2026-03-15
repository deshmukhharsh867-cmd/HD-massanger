import React, { useState, useRef, useEffect } from 'react';

const CATEGORIES = [
  {
    label: '😀', name: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖']
  },
  {
    label: '👋', name: 'Gestures',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸']
  },
  {
    label: '❤️', name: 'Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭']
  },
  {
    label: '🐶', name: 'Animals',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔']
  },
  {
    label: '🍕', name: 'Food',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾']
  },
  {
    label: '⚽', name: 'Sports',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🪆','🎮','🕹️','🎲','🧩','🪅','🎭','🎨','🧵','🧶','🎪','🤹','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗']
  },
  {
    label: '🌍', name: 'Travel',
    emojis: ['🌍','🌎','🌏','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪']
  },
  {
    label: '💡', name: 'Objects',
    emojis: ['💡','🔦','🕯️','🪔','🧯','🛢️','💰','💳','💎','⚖️','🪜','🧲','🔧','🔨','⚒️','🛠️','⛏️','🔩','🪛','🔫','🪃','🛡️','🔑','🗝️','🔐','🔏','🔒','🔓','🚪','🪞','🪟','🛋️','🪑','🚽','🪠','🚿','🛁','🪤','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🧯','🛒','🚬','⚰️','🪦','⚱️','🏺','🔮','🧿','💈','⚗️','🔭','🔬','🩻','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧲','🪜','🧰','🪤','🪝']
  },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch]       = useState('');
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const searchResults = search.trim()
    ? CATEGORIES.flatMap(c => c.emojis).filter(e => {
        // Basic unicode search — just show all emojis when searching (no name lookup)
        return true;
      }).slice(0, 80)
    : null;

  const displayed = searchResults || CATEGORIES[activeTab].emojis;

  return (
    <div className="emoji-picker" ref={pickerRef}>
      {/* Search */}
      <div className="emoji-search-wrap">
        <input
          className="emoji-search"
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className="emoji-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="emoji-tabs">
          {CATEGORIES.map((cat, i) => (
            <button
              key={i}
              className={'emoji-tab' + (activeTab === i ? ' emoji-tab--active' : '')}
              onClick={() => setActiveTab(i)}
              title={cat.name}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="emoji-grid">
        {displayed.map((emoji, i) => (
          <button
            key={i}
            className="emoji-btn"
            onClick={() => { onSelect(emoji); }}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category label */}
      {!search && (
        <div className="emoji-cat-label">{CATEGORIES[activeTab].name}</div>
      )}
    </div>
  );
}
