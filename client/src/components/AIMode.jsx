import React, { useState, useRef, useEffect } from 'react';

export const PERSONAS = [
  { id: 'friend',     emoji: '👫', label: 'Friend',       color: '#3a9bd5' },
  { id: 'girlfriend', emoji: '💕', label: 'Girlfriend',   color: '#e84393' },
  { id: 'boyfriend',  emoji: '💙', label: 'Boyfriend',    color: '#7c5cbf' },
  { id: 'crush',      emoji: '🥰', label: 'Crush',        color: '#ff6b35' },
  { id: 'bestie',     emoji: '🔥', label: 'Best Friend',  color: '#2dd4a0' },
  { id: 'classmate',  emoji: '📚', label: 'Classmate',    color: '#ffd166' },
  { id: 'colleague',  emoji: '💼', label: 'Colleague',    color: '#6c757d' },
  { id: 'family',     emoji: '🏠', label: 'Family',       color: '#20c997' },
  { id: 'ex',         emoji: '💔', label: 'Ex',           color: '#dc3545' },
  { id: 'stranger',   emoji: '👤', label: 'New Person',   color: '#adb5bd' },
];

export const LANGUAGES = [
  { id: 'english',  label: 'English',  flag: '🇬🇧' },
  { id: 'hindi',    label: 'Hinglish', flag: '🇮🇳' },
  { id: 'marathi',  label: 'Marathish', flag: '🟠' },
];

function getLangInstruction(langId) {
  if (langId === 'hindi')   return 'CRITICAL RULE: You MUST write ALL replies ONLY in Hinglish (Hindi words spelled in English/Roman letters). NEVER use Devanagari script (no ह, क, म etc). ONLY Roman letters. Examples: "Namaste!", "Arre yaar kya hua?", "Bahut accha laga!", "Sach mein?", "Main tere saath hoon", "Koi baat nahi". Every single word must be in Roman/English letters.';
  if (langId === 'marathi') return 'CRITICAL RULE: You MUST write ALL replies ONLY in Roman Marathi (Marathi words spelled in English/Roman letters). NEVER EVER use Devanagari script (no म, क, त, ह etc). ZERO Devanagari allowed. ONLY Roman/English letters. Examples: "Namaskaar!", "Kasa kaay?", "Arre khara ka?", "Khup chhan vatla!", "Mi tuzya sobat aahe", "Kaahi nahi", "Ho na!", "Chan ahe!". Every single word in Roman letters only.';
  return 'Write all replies in English.';
  return 'Write replies in English.';
}

function getPersonaPrompt(personaId, partnerName, langId) {
  const lang = getLangInstruction(langId);
  const p = {
    friend:     `You help the user chat with their friend ${partnerName}. Casual, funny, genuine. ${lang}`,
    girlfriend: `You help the user chat with their girlfriend ${partnerName}. Sweet, romantic, emotionally intelligent. ${lang}`,
    boyfriend:  `You help the user chat with their boyfriend ${partnerName}. Warm, supportive, loving. ${lang}`,
    crush:      `You help the user chat with their crush ${partnerName}. Charming, playful, confident, create chemistry. ${lang}`,
    bestie:     `You help the user chat with their best friend ${partnerName}. Super casual, banter, no filter. ${lang}`,
    classmate:  `You help the user chat with their classmate ${partnerName}. Friendly, relatable, school context. ${lang}`,
    colleague:  `You help the user chat with their colleague ${partnerName}. Professional yet friendly. ${lang}`,
    family:     `You help the user chat with a family member ${partnerName}. Warm and respectful. ${lang}`,
    ex:         `You help the user chat with their ex ${partnerName}. Calm, composed, no drama. ${lang}`,
    stranger:   `You help the user chat with someone new named ${partnerName}. Friendly, great first impression. ${lang}`,
  };
  return p[personaId] || p.friend;
}

// ── Persona Picker ─────────────────────────────────────────────
export function PersonaPicker({ partnerName, current, onSelect, onClose }) {
  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-picker" onClick={e => e.stopPropagation()}>
        <div className="ai-picker-header">
          <div className="ai-picker-title"><span className="ai-spark">✨</span> AI Mode</div>
          <div className="ai-picker-sub">Who is <strong>{partnerName}</strong> to you?</div>
          <button className="ai-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="ai-persona-grid">
          {PERSONAS.map(p => (
            <button key={p.id}
              className={'ai-persona-btn' + (current?.id === p.id ? ' ai-persona-btn--active' : '')}
              style={current?.id === p.id ? { borderColor: p.color, background: p.color + '22' } : {}}
              onClick={() => { onSelect(p); onClose(); }}>
              <span className="ai-persona-emoji">{p.emoji}</span>
              <span className="ai-persona-label">{p.label}</span>
            </button>
          ))}
        </div>
        {current && (
          <button className="ai-clear-btn" onClick={() => { onSelect(null); onClose(); }}>
            Turn off AI Mode
          </button>
        )}
      </div>
    </div>
  );
}

// ── AI Reply / Starter Panel ───────────────────────────────────
export function AIReplyPanel({ message, persona, partnerName, conversationHistory, myUid, onUseReply, onDismiss }) {
  const isStarter = !message;
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [analysis,    setAnalysis]    = useState('');
  const [tone,        setTone]        = useState('balanced');
  const [lang,        setLang]        = useState('english');
  const abortRef = useRef(null);

  // Re-fetch whenever message, tone, or language changes
  useEffect(() => {
    fetchSuggestions(tone, lang);
    return () => { try { abortRef.current?.abort(); } catch {} };
  }, [message, tone, lang]);

  const fetchSuggestions = async (selectedTone, selectedLang) => {
    // Cancel previous request
    try { abortRef.current?.abort(); } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSuggestions([]);
    setAnalysis('');

    // Build conversation history with correct roles
    const recentHistory = (conversationHistory || [])
      .filter(m => m.type === 'text' && !m.deleted)
      .slice(-8)
      .map(m => ({
        role: m.sender_id === myUid ? 'user' : 'assistant',
        content: m.text || ''
      }))
      // Groq requires alternating roles — merge consecutive same-role messages
      .reduce((acc, msg) => {
        if (acc.length && acc[acc.length - 1].role === msg.role) {
          acc[acc.length - 1].content += '\n' + msg.content;
        } else {
          acc.push({ ...msg });
        }
        return acc;
      }, []);

    const langNote = getLangInstruction(selectedLang);

    const systemPrompt = isStarter
      ? `${getPersonaPrompt(persona.id, partnerName, selectedLang)}

The user wants to START a conversation with ${partnerName}. No messages yet.
Tone: ${selectedTone}
${langNote}

Give 3 natural opening messages. NOT generic. Match the persona vibe.
REMINDER: ${langNote}

Respond ONLY as valid JSON, no markdown fences, no extra text:
{"analysis":"One tip for approaching ${partnerName} as a ${persona.label}","replies":[{"label":"style","text":"message"},{"label":"style","text":"message"},{"label":"style","text":"message"}]}`
      : `${getPersonaPrompt(persona.id, partnerName, selectedLang)}

The user received this message: "${message}"
Tone: ${selectedTone}
${langNote}

Give 3 natural reply suggestions. Sound human, not robotic.
REMINDER: ${langNote}

Respond ONLY as valid JSON, no markdown fences, no extra text:
{"analysis":"What this message means/mood in 1-2 sentences","replies":[{"label":"style","text":"reply"},{"label":"style","text":"reply"},{"label":"style","text":"reply"}]}`;

    const userMsg = isStarter
      ? `Start a conversation with ${partnerName} (my ${persona.label}). Give 3 opening messages. Tone: ${selectedTone}.`
      : `They sent: "${message}". Give 3 reply suggestions. Tone: ${selectedTone}.`;

    // Build messages array — must start with user role for Groq
    const apiMessages = recentHistory.length > 0
      ? [...recentHistory, { role: 'user', content: userMsg }]
      : [{ role: 'user', content: userMsg }];

    // Ensure first message is user role
    if (apiMessages[0]?.role !== 'user') {
      apiMessages.unshift({ role: 'user', content: '(conversation context)' });
    }

    try {
      const token = localStorage.getItem('hd_token');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          max_tokens: 800,
          system: systemPrompt,
          messages: apiMessages
        })
      });

      const data = await res.json();

      if (!res.ok || !data.content) {
        const raw_err = data.error;
        const errMsg = typeof raw_err === 'string'
          ? raw_err
          : (raw_err?.message || raw_err?.type || JSON.stringify(raw_err) || 'Unknown error');
        const errLow = errMsg.toLowerCase();

        if (errLow.includes('groq_api_key') || errLow.includes('not set') || errLow.includes('your_groq_key_here')) {
          setSuggestions([{ label: '🔑 Setup', text: '1. Get FREE key at console.groq.com\n2. Open server/.env\n3. Set GROQ_API_KEY=gsk_...\n4. Restart: npm start' }]);
        } else if (errLow.includes('invalid') || errLow.includes('unauthorized') || errLow.includes('auth')) {
          setSuggestions([{ label: '🔑 Wrong Key', text: 'Groq API key is invalid.\nGet a new one at console.groq.com → API Keys\nUpdate server/.env and restart.' }]);
        } else if (errLow.includes('rate') || errLow.includes('limit')) {
          setSuggestions([{ label: '⏳ Rate Limited', text: 'Groq free tier rate limit hit.\nWait 10 seconds and try again!' }]);
        } else {
          setSuggestions([{ label: '⚠️ Error', text: errMsg }]);
        }
        return;
      }

      // Parse JSON from AI response
      const raw = data.content[0]?.text || '{}';
      const clean = raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch {
        // Try to extract JSON from response if it has extra text
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); }
          catch { parsed = null; }
        }
      }

      if (!parsed?.replies?.length) {
        setSuggestions([{ label: '⚠️ Parse Error', text: 'AI gave unexpected response. Try again!' }]);
        return;
      }

      setAnalysis(parsed.analysis || '');
      setSuggestions(parsed.replies);

    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('AI error:', e);
      setSuggestions([{ label: '⚠️ Error', text: 'Could not reach server.\nMake sure npm start is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  const TONES = [
    { id: 'balanced', label: '⚖️ Normal' },
    { id: 'flirty',   label: '😏 Flirty' },
    { id: 'funny',    label: '😂 Funny'  },
    { id: 'serious',  label: '🎯 Direct' },
  ];

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-left">
          <span className="ai-panel-icon">{persona.emoji}</span>
          <div>
            <div className="ai-panel-title">{isStarter ? '🚀 How to start chatting' : '🤖 AI Reply Coach'}</div>
            <div className="ai-panel-sub">{persona.label} · {isStarter ? `opening for ${partnerName}` : `replying to ${partnerName}`}</div>
          </div>
        </div>
        <button className="ai-panel-close" onClick={onDismiss}>✕</button>
      </div>

      {/* Message being analyzed */}
      <div className="ai-analyzed-msg">
        <div className="ai-analyzed-label">{isStarter ? '💬 First message ideas' : '📩 Their message'}</div>
        <div className="ai-analyzed-text" style={isStarter ? { fontStyle: 'normal' } : {}}>
          {isStarter ? 'No messages yet — AI will suggest great opening lines ✨' : `"${message}"`}
        </div>
      </div>

      {/* Analysis */}
      {(analysis || loading) && (
        <div className="ai-analysis-box">
          <span className="ai-analysis-icon">{isStarter ? '💡' : '🧠'}</span>
          {loading
            ? <span className="ai-analysis-text ai-shimmer">{isStarter ? 'Thinking of openers...' : 'Analyzing...'}</span>
            : <span className="ai-analysis-text">{analysis}</span>
          }
        </div>
      )}

      {/* Tone + Language selectors */}
      <div className="ai-tone-bar">
        <span className="ai-tone-label">Tone:</span>
        {TONES.map(t => (
          <button key={t.id}
            className={'ai-tone-btn' + (tone === t.id ? ' ai-tone-btn--active' : '')}
            onClick={() => setTone(t.id)}>{t.label}
          </button>
        ))}
      </div>

      <div className="ai-tone-bar ai-lang-bar">
        <span className="ai-tone-label">Lang:</span>
        {LANGUAGES.map(l => (
          <button key={l.id}
            className={'ai-tone-btn' + (lang === l.id ? ' ai-tone-btn--active' : '')}
            onClick={() => setLang(l.id)}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Suggestions */}
      <div className="ai-suggestions">
        {loading && [1,2,3].map(i => (
          <div key={i} className="ai-suggestion ai-suggestion--loading">
            <div className="ai-sug-shimmer"/>
          </div>
        ))}
        {!loading && suggestions.map((s, i) => (
          <div key={i} className="ai-suggestion">
            <div className="ai-sug-label">{s.label}</div>
            <div className="ai-sug-text">{s.text}</div>
            <button className="ai-use-btn" onClick={() => onUseReply(s.text)}>
              {isStarter ? 'Send ↗' : 'Use ↗'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
