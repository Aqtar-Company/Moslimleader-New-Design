// Speech-to-text helper. Uses Gemini's multimodal endpoint (free
// on the same key already configured for the FB / Ameen assistant).
// Whisper isn't wired here on purpose — owner has no OpenAI credit
// today; revisit if Egyptian-dialect accuracy on Gemini turns out
// to be insufficient.
//
// The returned string is the raw transcription; the caller feeds
// it through the existing chat pipeline like any typed message.

import { getAssistantSettings } from './ai-facebook-assistant';

export class SttError extends Error {
  code: 'NO_KEY' | 'EMPTY' | 'API_FAILED';
  constructor(code: 'NO_KEY' | 'EMPTY' | 'API_FAILED', message: string) {
    super(message);
    this.code = code;
  }
}

export async function transcribeAudio(file: File): Promise<string> {
  const settings = await getAssistantSettings();
  const key = settings.apiKeys?.gemini;
  if (!key) throw new SttError('NO_KEY', 'Gemini key not configured for STT');

  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString('base64');
  // Gemini accepts audio/webm directly; the prompt steers it to a
  // bare transcription rather than a summary.
  const body = {
    contents: [{
      parts: [
        { text: 'فرّغ هذا الملف الصوتي إلى نص باللغة العربية المصرية الدارجة. أجب بالنص فقط بدون أي تعليق أو علامات اقتباس.' },
        { inline_data: { mime_type: file.type || 'audio/webm', data: b64 } },
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
    throw new SttError('API_FAILED', `Gemini STT failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new SttError('EMPTY', 'Gemini returned empty transcription');
  return text;
}
