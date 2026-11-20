// Speech Recognition & Synthesis Declarations
import { API_BASE_URL } from './apiConfig';

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export const getLanguageBcp47 = (langCode: string): string => {
  switch (langCode) {
    case 'hinglish':
    case 'raj':
    case 'hi':
      return 'hi-IN';
    case 'gu':
      return 'gu-IN';
    case 'mr':
      return 'mr-IN';
    case 'bn':
      return 'bn-IN';
    case 'ta':
      return 'ta-IN';
    case 'te':
      return 'te-IN';
    case 'kn':
      return 'kn-IN';
    case 'ml':
      return 'ml-IN';
    case 'pa':
      return 'pa-IN';
    case 'en':
    default:
      return 'en-IN';
  }
};

export const isSpeechRecognitionSupported = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
};

export const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

export const createSpeechRecognition = (langCode: string): SpeechRecognitionInstance | null => {
  if (typeof window === 'undefined') return null;
  const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionConstructor) return null;

  const recognition = new SpeechRecognitionConstructor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = getLanguageBcp47(langCode);
  return recognition;
};

/**
 * Text-to-speech helper that selects the most fitting voice for the given language
 */
export const speakText = (
  text: string, 
  langCode: string, 
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
): SpeechSynthesisUtterance | null => {
  if (!isSpeechSynthesisSupported()) {
    options?.onEnd?.();
    return null;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip markdown formatting symbols like asterisks, hashtags, backticks
  const cleanedText = text
    .replace(/[*#`_~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, '. ')
    .trim();

  if (!cleanedText) {
    options?.onEnd?.();
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  const targetBcp = getLanguageBcp47(langCode);
  utterance.lang = targetBcp;
  utterance.rate = 0.92;
  utterance.pitch = 1.12;

  const voices = window.speechSynthesis.getVoices();
  const languageVoices = voices.filter((voice) => voice.lang.toLowerCase() === targetBcp.toLowerCase()
    || voice.lang.toLowerCase().startsWith(`${targetBcp.split('-')[0].toLowerCase()}-`));
  const femaleVoice = languageVoices.find((voice) => /female|zira|heera|veena|samantha|sara|aria|jenny|sonia|swara|aditi|lekha/i.test(voice.name));
  const matchedVoice = femaleVoice
    || languageVoices[0]
    || voices.find((voice) => /female|zira|heera|veena|samantha|sara|aria|jenny|sonia|swara|aditi|lekha/i.test(voice.name))
    || voices.find((voice) => voice.lang.includes('IN'))
    || voices.find((voice) => voice.lang.startsWith('en'));

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    options?.onEnd?.();
  };

  utterance.onerror = (e) => {
    options?.onError?.(e);
    options?.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
};

export const stopSpeech = () => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
  if (activeKhushiAudio) {
    URL.revokeObjectURL(activeKhushiAudio.src);
    activeKhushiAudio.pause();
    activeKhushiAudio.currentTime = 0;
    activeKhushiAudio = null;
  }
};

let activeKhushiAudio: HTMLAudioElement | null = null;

export const transcribeVoiceRecording = async (recording: Blob): Promise<string> => {
  const mimeType = recording.type.split(';')[0] || 'audio/webm';
  const bytes = new Uint8Array(await recording.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mimeType, audio: btoa(binary) })
  });
  const result = await response.json() as { transcript?: string; message?: string };
  if (!response.ok) throw new Error(result.message || 'Voice transcription failed.');
  return result.transcript?.trim() || '';
};

/** Uses server generated Khushi audio when browser speech is unavailable. */
export const speakKhushiReply = async (
  text: string,
  langCode: string,
  options?: { onStart?: () => void; onEnd?: () => void; onError?: (err: unknown) => void }
): Promise<void> => {
  const cleanText = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#`_~]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*(?:[•*-]|\d+[.)])\s*/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '; ')
    .replace(/:\s*;/g, ': ')
    .trim();
  if (!cleanText) return options?.onEnd?.();
  stopSpeech();
  try {
    const response = await fetch(`${API_BASE_URL}/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: cleanText, language: langCode })
    });
    if (!response.ok) throw new Error('Voice service did not return audio.');
    const result = await response.json() as { audio?: string; mimeType?: string };
    if (!result.audio) throw new Error('Voice service returned an empty audio response.');
    const binary = atob(result.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'audio/wav' })));
    activeKhushiAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(audio.src);
      if (activeKhushiAudio === audio) activeKhushiAudio = null;
      options?.onEnd?.();
    };
    audio.onerror = (event) => {
      URL.revokeObjectURL(audio.src);
      if (activeKhushiAudio === audio) activeKhushiAudio = null;
      options?.onError?.(event);
      options?.onEnd?.();
    };
    await audio.play();
    options?.onStart?.();
  } catch (error) {
    // On supported browsers, keep local speech as a graceful fallback if TTS fails.
    if (isSpeechSynthesisSupported()) {
      speakText(cleanText, langCode, options);
      return;
    }
    options?.onError?.(error);
    options?.onEnd?.();
  }
};
