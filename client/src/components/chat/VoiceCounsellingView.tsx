import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AIAvatar } from '@/components/common/AIAvatar';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Volume2, 
  Sparkles, 
  Radio, 
  MessageSquare,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { SupportedLanguage } from '@/types/models';
import { getKhushiSuggestions, getKhushiWelcome } from '@/lib/khushi';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { aiChatService } from '@/services/aiChatService';
import { 
  createSpeechRecognition, 
  speakKhushiReply, 
  transcribeVoiceRecording,
  stopSpeech, 
  isSpeechRecognitionSupported, 
  isSpeechSynthesisSupported,
  SpeechRecognitionInstance 
} from '@/services/voiceService';

export interface VoiceCounsellingViewProps {
  onSwitchToChat: () => void;
  selectedLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  conversationId?: string;
  onNewMessageFromVoice?: (userText: string, aiText: string) => void;
}

interface TranscriptItem {
  speaker: 'ai' | 'student';
  text: string;
  time: string;
}

export const VoiceCounsellingView: React.FC<VoiceCounsellingViewProps> = ({
  onSwitchToChat,
  selectedLanguage,
  onLanguageChange,
  conversationId: initialConvId,
  onNewMessageFromVoice
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'requesting' | 'listening' | 'processing' | 'speaking'>('idle');
  const [liveSpeechText, setLiveSpeechText] = useState('');
  const [convId, setConvId] = useState<string>(initialConvId || '');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    {
      speaker: 'ai',
      text: getKhushiWelcome(selectedLanguage),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);
  const hasSpokenWelcomeRef = useRef(false);
  isMutedRef.current = isMuted;
  const speechRecognitionSupported = isSpeechRecognitionSupported();
  const recordingSupported = typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
  const voiceInputSupported = speechRecognitionSupported || recordingSupported;

  useEffect(() => {
    setTranscript((previous) => previous.length === 1
      ? [{ ...previous[0], text: getKhushiWelcome(selectedLanguage) }]
      : previous);
  }, [selectedLanguage]);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, liveSpeechText]);

  // Check browser speech recognition support
  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    if (!supported && !recordingSupported) {
      setVoiceError('Voice input is not supported in this browser. You can still use the sample questions or switch to chat.');
    }
  }, [recordingSupported]);

  // Initialize conversation session for voice channel
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!convId) {
        const id = await aiChatService.createConversation(selectedLanguage, 'voice');
        if (isMounted && id) {
          setConvId(id);
        }
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [selectedLanguage, convId]);

  // Speak Khushi's introduction once on entering voice mode.
  useEffect(() => {
    if (!hasSpokenWelcomeRef.current && !isMuted && isSpeechSynthesisSupported()) {
      hasSpokenWelcomeRef.current = true;
      speakKhushiReply(
        getKhushiWelcome(selectedLanguage),
        selectedLanguage,
        {
          onStart: () => setVoiceState('speaking'),
          onEnd: () => setVoiceState('idle')
        }
      );
    }
    return () => {
      stopSpeech();
    };
  }, [isMuted, selectedLanguage]);

  // Send student voice query to backend AI
  const processVoiceInput = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) {
      setVoiceState('idle');
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTranscript((prev) => [
      ...prev,
      { speaker: 'student', text: spokenText, time: timeStr }
    ]);
    setLiveSpeechText('');
    setVoiceState('processing');

    try {
      const activeId = convId || `conv_voice_${Date.now()}`;
      const response = await aiChatService.sendMessage({
        conversationId: activeId,
        message: spokenText,
        language: selectedLanguage,
        channel: 'voice'
      });

      const replyText = response.success
        ? response.reply
        : "I can help you explore KV's creative courses, tools, and fees. Could you say that once more, or tell me what you would like to create?";

      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'ai',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (onNewMessageFromVoice) {
        onNewMessageFromVoice(spokenText, replyText);
      }

      // Voice synthesize AI response
      if (!isMutedRef.current) {
        speakKhushiReply(replyText, selectedLanguage, {
          onStart: () => setVoiceState('speaking'),
          onEnd: () => {
            setVoiceState('idle');
          },
          onError: () => setVoiceState('idle')
        });
      } else {
        setVoiceState('idle');
      }
    } catch {
      setVoiceState('idle');
    }
  }, [convId, selectedLanguage, onNewMessageFromVoice]);

  const startRecordingFallback = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      setVoiceError(null);
      setVoiceState('requesting');
      setLiveSpeechText('Requesting microphone access…');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      stream = mediaStream;
      streamRef.current = mediaStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstart = () => {
        setVoiceState('listening');
        setLiveSpeechText('Speak naturally, then tap Done Speaking.');
      };
      recorder.onstop = async () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setLiveSpeechText('');
        const recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!recording.size) { setVoiceState('idle'); return; }
        setVoiceState('processing');
        try {
          const transcriptText = await transcribeVoiceRecording(recording);
          if (transcriptText) await processVoiceInput(transcriptText);
          else {
            setVoiceError('I could not hear a clear question. Please try again when you are ready.');
            setVoiceState('idle');
          }
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed. Please try again.');
          setVoiceState('idle');
        }
      };
      recorder.onerror = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setVoiceError('The recording could not start. Please check microphone access and try again.');
        setVoiceState('idle');
      };
      recorderRef.current = recorder;
      recorder.start();
      setVoiceError(null);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      const name = error instanceof DOMException ? error.name : '';
      setLiveSpeechText('');
      setVoiceError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone permission is blocked. Allow microphone access in your browser settings, then tap Start Speaking again.'
        : name === 'NotFoundError'
        ? 'No microphone was found. Connect a microphone or use the sample questions.'
        : name === 'NotReadableError'
        ? 'The microphone is busy in another app. Close that app and try again.'
        : 'Microphone could not start. Check browser permissions and try again, or switch to chat.');
      setVoiceState('idle');
    }
  }, [processVoiceInput]);

  // Start speech recognition listening
  const startListening = useCallback(() => {
    stopSpeech();
    setVoiceError(null);

    // Prefer recording and server transcription where available. Browser speech
    // recognition often ends without a transcript in embedded browsers.
    if (recordingSupported) {
      void startRecordingFallback();
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setVoiceError('Voice input is not supported in this browser. You can still use the sample questions or switch to chat.');
      setVoiceState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = createSpeechRecognition(selectedLanguage);
      if (!recognition) return;
      let finalResultReceived = false;

      recognition.onstart = () => {
        setVoiceState('listening');
        setLiveSpeechText('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        if (interim) {
          setLiveSpeechText(interim);
        }

        if (final.trim() && !finalResultReceived) {
          finalResultReceived = true;
          setLiveSpeechText(final);
          recognition.stop();
          processVoiceInput(final.trim());
        }
      };

      recognition.onerror = (e) => {
        const message = e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow microphone access for this page in your browser, then try again.'
          : e.error === 'no-speech'
          ? 'I didn’t hear anything. Please try again when you’re ready.'
          : e.error === 'language-not-supported'
          ? 'This browser does not support speech recognition for the selected language. Try another language or use a sample question.'
          : 'Voice input could not start. Please try again or use a sample question.';
        setVoiceError(message);
        if (e.error !== 'no-speech') console.warn('[Speech Recognition Warning]:', e.error);
        setVoiceState('idle');
      };

      recognition.onend = () => {
        if (!finalResultReceived) {
          setVoiceError('I didn’t catch that. Please tap Start Speaking and try again.');
          setVoiceState('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.warn('Speech recognition start failed:', err);
      setVoiceError('Voice input could not start. Please check your browser microphone access and try again.');
      setVoiceState('idle');
    }
  }, [selectedLanguage, processVoiceInput, recordingSupported, startRecordingFallback]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setVoiceState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.onerror = null;
        recorderRef.current.stop();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Handle Mute toggle
  const toggleMute = () => {
    if (!isMuted) {
      stopSpeech();
      if (voiceState === 'speaking') {
        setVoiceState('idle');
      }
    }
    setIsMuted(!isMuted);
  };

  // Quick preset voice simulation prompts for quick testing or fallback browsers
  const runSimulatedPrompt = (promptText: string) => {
    stopSpeech();
    processVoiceInput(promptText);
  };

  return (
    <div className="flex flex-col h-full bg-primary-800 text-white rounded-2xl overflow-hidden shadow-2xl border border-primary-700">
      {/* Voice Session Header */}
      <div className="p-4 sm:p-5 border-b border-primary-700 flex items-center justify-between bg-primary-700/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary-400 border border-primary-500/30 flex items-center justify-center">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Khushi · Voice Course Guide</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                voiceState === 'listening'
                  ? 'bg-secondary-400/20 text-secondary-100 border-secondary-300/40 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-primary-400/30 text-primary-50 border-primary-200/40 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : voiceState === 'requesting'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {voiceState === 'requesting' ? 'Connecting mic...' : voiceState === 'listening' ? 'Listening...' : voiceState === 'speaking' ? 'Speaking...' : voiceState === 'processing' ? 'Thinking...' : 'Ready'}
              </span>
            </div>
            <p className="text-[11px] text-primary-100">Choose English, Hindi, Hinglish, or Gujarati; Khushi replies in voice</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={(lang) => {
              onLanguageChange(lang);
              stopSpeech();
            }}
            className="text-slate-900"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              stopSpeech();
              onSwitchToChat();
            }}
            className="text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 h-8 gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Switch to Text Chat
          </Button>
        </div>
      </div>

      {voiceError && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Main Voice Visualizer Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-primary-800 via-primary-800 to-primary-700">
        {/* Visualizer Ambient Background Glow */}
        <div className={`absolute w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          voiceState === 'listening'
            ? 'bg-secondary-400/20 scale-125'
            : voiceState === 'speaking'
            ? 'bg-primary-300/30 scale-125'
            : 'bg-primary/10'
        }`}></div>

        {/* Large Animated AI Avatar */}
        <div className="relative mb-6">
          <AIAvatar
            size="xl"
            isSpeaking={voiceState === 'speaking'}
            isListening={voiceState === 'listening'}
            mode="voice"
          />
        </div>

        {/* Status Callout */}
        <div className="text-center space-y-1 mb-6 z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-200 shadow-lg">
            {voiceState === 'speaking' ? (
              <>
                <Volume2 className="w-4 h-4 text-secondary-300 animate-bounce" />
                <span>Khushi is speaking...</span>
              </>
            ) : voiceState === 'listening' ? (
              <>
                <Mic className="w-4 h-4 text-secondary-300 animate-pulse" />
                <span>Listening to you... Click mic when done</span>
              </>
            ) : voiceState === 'processing' ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Khushi is thinking...</span>
              </>
            ) : voiceState === 'requesting' ? (
              <>
                <Mic className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>Requesting microphone access...</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4 text-primary-400" />
                <span>Click &quot;Start Speaking&quot; or tap the Mic button</span>
              </>
            )}
          </div>

          {liveSpeechText && (
            <div className="mt-2 text-xs text-primary-100 italic bg-primary-800/70 border border-primary-700/60 px-3 py-1.5 rounded-lg animate-pulse">
              &quot;{liveSpeechText}&quot;
            </div>
          )}

          <p className="text-[11px] text-slate-400 pt-1">
            Microphone access starts only when you tap Start Speaking. Voice transcription uses the connected AI service.
          </p>
        </div>

        {/* Sound Wave Animation Bars */}
        <div className="flex items-center gap-1.5 h-10 mb-6">
          {[...Array(18)].map((_, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                voiceState === 'speaking'
                  ? 'bg-gradient-to-t from-secondary-400 to-primary-300 animate-wave-1'
                  : voiceState === 'listening'
                  ? 'bg-secondary-300 animate-wave-3'
                  : 'bg-primary-500 h-2'
              }`}
              style={{
                animationDelay: `${(i % 6) * 0.12}s`,
                height: voiceState === 'idle' ? '4px' : undefined
              }}
            />
          ))}
        </div>

        {/* Suggested Voice Prompts */}
        <div className="w-full max-w-xl mb-4 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Try a sample question · tap to hear Khushi:
          </span>
          {[
            ...getKhushiSuggestions(selectedLanguage).slice(0, 3)
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => runSimulatedPrompt(q)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all truncate max-w-[200px]"
            >
              &quot;{q}&quot;
            </button>
          ))}
        </div>

        {/* Live Transcript Drawer */}
        <div className="w-full max-w-xl bg-primary-900/70 border border-primary-600 rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 text-xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-100 pb-1.5 border-b border-primary-600 flex items-center justify-between">
            <span>Voice Conversation Transcript</span>
            <span className="text-secondary-200 text-[10px]">Khushi is here</span>
          </div>
          {transcript.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300">
              <span className={`font-semibold text-[10px] ${item.speaker === 'ai' ? 'text-secondary-200' : 'text-primary-200'}`}>
                {item.speaker === 'ai' ? 'Khushi' : 'You'}:
              </span>
              <p className="flex-1 text-slate-200">{item.text}</p>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">{item.time}</span>
            </div>
          ))}
          <div ref={transcriptBottomRef} />
        </div>
      </div>

      {/* Voice Controls Bar */}
      <div className="p-4 sm:p-5 bg-primary-800 border-t border-primary-700 flex items-center justify-center gap-4">
        {/* Toggle Mute / Speaker */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          className={`h-12 w-12 rounded-full border-slate-700 ${
            isMuted 
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' 
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Audio Voice' : 'Mute Audio Voice'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>

        {/* Main Mic Push-to-Talk / Toggle */}
        {voiceState === 'listening' ? (
          <Button
            size="default"
            onClick={stopListening}
            className="rounded-full bg-secondary-400 hover:bg-secondary-500 text-slate-950 px-7 font-semibold shadow-lg shadow-secondary-900/30 h-12 gap-2 animate-pulse"
          >
            <Mic className="w-5 h-5 text-white" />
            <span>Done Speaking</span>
          </Button>
        ) : (
          <Button
            size="default"
            onClick={startListening}
          disabled={voiceState === 'processing' || voiceState === 'requesting' || !voiceInputSupported}
            className="rounded-full bg-primary hover:bg-primary-600 text-white px-7 font-semibold shadow-lg shadow-primary/25 h-12 gap-2"
          >
            <Mic className="w-5 h-5" />
            <span>{voiceInputSupported ? 'Start Speaking' : 'Mic unavailable'}</span>
          </Button>
        )}

        {/* Replay Last AI Speech */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const lastAiMsg = [...transcript].reverse().find(t => t.speaker === 'ai');
            if (lastAiMsg && !isMuted) {
              speakKhushiReply(lastAiMsg.text, selectedLanguage, {
                onStart: () => setVoiceState('speaking'),
                onEnd: () => setVoiceState('idle')
              });
            }
          }}
          className="h-12 w-12 rounded-full bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          title="Replay Last AI Voice"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* End Voice Call */}
        <Button
          variant="destructive"
          size="icon"
          onClick={() => {
            stopSpeech();
            onSwitchToChat();
          }}
          className="h-12 w-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/30"
          title="End Voice Mode & Return to Chat"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

