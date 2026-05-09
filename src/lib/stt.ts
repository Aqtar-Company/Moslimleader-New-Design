// Speech-to-text helper. Tries OpenAI Whisper first when the key is
// configured (best Egyptian-Arabic accuracy and accepts the raw
// audio/webm blob from MediaRecorder without any container hacks),
// then falls back to Gemini multimodal (free on the same key
// already used by the assistant). Either path returns a plain text
// transcription that the caller feeds through the existing chat
// pipeline like any typed message.

import { getAssistantSettings } from './ai-facebook-assistant';

export class SttError extends Error {
  code: 'NO_KEY' | 'EMPTY' | 'API_FAILED';
  constructor(code: 'NO_KEY' | 'EMPTY' | 'API_FAILED', message: string) {
    super(message);
    this.code = code;
  }
}

// Gemini's accepted audio mime list:
//   audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac
// MediaRecorder on Chrome/Android records as audio/webm;codecs=opus,
// which Gemini rejects with a 400 even though webm and ogg both wrap
// Opus frames. Empirically Gemini sometimes decodes the same bytes
// when labelled audio/ogg — but it's hit-or-miss, which is why we
// prefer Whisper when available.
function geminiCompatibleMime(input: string): string {
  const m = (input || '').toLowerCase().split(';')[0].trim();
  if (m === 'audio/webm') return 'audio/ogg';
  if (m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/m4a') return 'audio/aac';
  if (m === '' || m === 'application/octet-stream') return 'audio/ogg';
  return m;
}

async function transcribeWithWhisper(file: File, key: string): Promise<string> {
  // Whisper accepts webm, mp4, ogg, wav, m4a, mp3 — no transcoding
  // needed. The "ar" language hint biases the model toward Arabic
  // (it would otherwise auto-detect, but the hint helps short
  // 1-2 second clips).
  const form = new FormData();
  form.append('file', file, file.name || 'voice.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'ar');
  form.append('response_format', 'text');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[stt] Whisper failed', res.status, file.type, text.slice(0, 400));
    throw new SttError('API_FAILED', `Whisper failed: ${res.status} ${text.slice(0, 200)}`);
  }
  // response_format=text returns plain text, not JSON.
  const text = (await res.text()).trim();
  if (!text) throw new SttError('EMPTY', 'Whisper returned empty transcription');
  return text;
}

async function transcribeWithGemini(file: File, key: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString('base64');
  const mime = geminiCompatibleMime(file.type);
  const body = {
    contents: [{
      parts: [
        { text: 'فرّغ هذا الملف الصوتي إلى نص باللغة العربية المصرية الدارجة. أجب بالنص فقط بدون أي تعليق أو علامات اقتباس.' },
        { inline_data: { mime_type: mime, data: b64 } },
      ],
    }],
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[stt] Gemini failed', res.status, mime, file.type, text.slice(0, 400));
    throw new SttError('API_FAILED', `Gemini STT failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new SttError('EMPTY', 'Gemini returned empty transcription');
  return text;
}

export async function transcribeAudio(file: File): Promise<string> {
  const settings = await getAssistantSettings();
  const openaiKey = settings.apiKeys?.openai;
  const geminiKey = settings.apiKeys?.gemini;

  // Prefer Whisper — it accepts the raw webm/mp4 from MediaRecorder
  // without container hacks and handles Egyptian dialect cleanly.
  // If it fails (no credit, network), fall back to Gemini before
  // giving up so a free-tier-only setup still works.
  if (openaiKey) {
    try {
      return await transcribeWithWhisper(file, openaiKey);
    } catch (err) {
      console.warn('[stt] Whisper failed, trying Gemini', err);
      if (!geminiKey) throw err;
    }
  }

  if (geminiKey) return await transcribeWithGemini(file, geminiKey);
  throw new SttError('NO_KEY', 'Neither OpenAI nor Gemini key is configured for STT');
}
