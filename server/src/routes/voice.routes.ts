import { Router, Request, Response } from 'express';
import { getGeminiClient } from '../ai/services/geminiService';
import { config } from '../config';

const router = Router();
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const allowedMimeTypes = new Set(['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']);

const makeWav = (pcm: Buffer, sampleRate = 24000): Buffer => {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

const languageNames: Record<string, string> = {
  en: 'English', hi: 'Hindi', hinglish: 'Hinglish, a natural Hindi and English mix', gu: 'Gujarati'
};

const khushiVoiceStyle = [
  'A warm, calm Indian woman counsellor talking to one student sitting with her.',
  'This is a genuine one-to-one conversation, not a presentation or voice-over.',
  'Sound attentive and understanding. Let the meaning guide your intonation; speak at a relaxed, natural pace with small pauses between thoughts.',
  'Be reassuring without sounding overly sweet or theatrical. Keep the voice clear, soft, and grounded.',
  'Do not sound like you are reading a script, article, list, or announcement. Do not add words, filler, or emotion that is not in the transcript.',
  'Pronounce familiar course and software names clearly.'
].join(' ');

router.post('/speak', async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const language = typeof req.body?.language === 'string' ? req.body.language : 'en';
  if (!text || text.length > 4000) return res.status(400).json({ message: 'Speech text must be between 1 and 4000 characters.' });
  const gemini = getGeminiClient();
  if (!gemini) return res.status(503).json({ message: 'Khushi voice is unavailable because the AI service is not configured.' });

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{
        role: 'user',
        parts: [{ text, speechMetadata: { style: `${khushiVoiceStyle} Speak in ${languageNames[language] || languageNames.en}.` } }]
      }],
      config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: 'Kore' } } }
    });
    const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!audioPart?.inlineData?.data) return res.status(502).json({ message: 'The voice service did not return audio. Please try again.' });
    const bytes = Buffer.from(audioPart.inlineData.data, 'base64');
    const wav = bytes.subarray(0, 4).toString() === 'RIFF' ? bytes : makeWav(bytes);
    return res.json({ audio: wav.toString('base64'), mimeType: 'audio/wav' });
  } catch (error) {
    console.error('[Voice TTS error]:', error instanceof Error ? error.message : error);
    return res.status(502).json({ message: 'Khushi could not create voice audio right now.' });
  }
});

router.post('/transcribe', async (req: Request, res: Response) => {
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.toLowerCase() : '';
  const audio = typeof req.body?.audio === 'string' ? req.body.audio : '';
  if (!allowedMimeTypes.has(mimeType) || !audio) return res.status(400).json({ message: 'A supported audio recording is required.' });
  if (audio.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3)) return res.status(413).json({ message: 'The recording is too large. Please record a shorter question.' });
  const gemini = getGeminiClient();
  if (!gemini) return res.status(503).json({ message: 'Voice transcription is unavailable because the AI service is not configured.' });

  try {
    const response = await gemini.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts: [
        { text: 'Transcribe the student speech exactly as spoken. Preserve Hindi, Gujarati, English, or Hinglish in its original script and wording. Return only the transcription. If there is no clear speech, return an empty response.' },
        { inlineData: { mimeType, data: audio } }
      ] }],
      config: { maxOutputTokens: 256 }
    });
    const transcript = response.text?.trim() || '';
    return res.json({ transcript: transcript.slice(0, 1200) });
  } catch (error) {
    console.error('[Voice transcription error]:', error instanceof Error ? error.message : error);
    return res.status(502).json({ message: 'The recording could not be understood. Please try again.' });
  }
});

export default router;
