import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIAvatar } from '@/components/common/AIAvatar';
import { ChatBubble } from '@/components/common/ChatBubble';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { VoiceCounsellingView } from '@/components/chat/VoiceCounsellingView';
import { SupportedLanguage } from '@/types/models';
import { aiChatService } from '@/services/aiChatService';
import { getKhushiSuggestions, getKhushiWelcome } from '@/lib/khushi';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { 
  Send, 
  Mic, 
  Trash2, 
  Headphones, 
  MessageSquare, 
  HelpCircle, 
  Plus, 
  Sparkles, 
  GraduationCap, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  isSimulated?: boolean;
}

export const DemoPage: React.FC = () => {
  const { health } = useHealthCheck();
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('Ready to chat');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: getKhushiWelcome('en'),
      time: 'Just now',
      isSimulated: false
    }
  ]);

  const courseQuestions = [
    { id: 'graphic', title: '6 in 1 Graphic Design', detail: '6 months' },
    { id: 'video', title: '6 in 1 Video Editing', detail: '6 months' },
    { id: 'combo', title: '12 in 1 Graphic & Video', detail: '8 months' },
    { id: 'uiux', title: '12 in 1 UI/UX Design', detail: '11 months' },
  ];

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(getKhushiSuggestions('en'));

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      const convId = await aiChatService.createConversation('en');
      if (isMounted && convId) {
        setConversationId(convId);
      }
    };
    initSession();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    setSuggestedQuestions(getKhushiSuggestions(selectedLanguage));
    setMessages((previous) => previous.length === 1 && previous[0].id === 'm-1'
      ? [{ ...previous[0], text: getKhushiWelcome(selectedLanguage) }]
      : previous);
  }, [selectedLanguage]);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim()) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal('');

    // Trigger typing indicator and query the real backend AI Chat API
    setIsTyping(true);

    try {
      let activeConvId = conversationId;
      if (!activeConvId) {
        activeConvId = await aiChatService.createConversation(selectedLanguage) || `conv_${Date.now()}`;
        setConversationId(activeConvId);
      }

      const response = await aiChatService.sendMessage({
        conversationId: activeConvId,
        message: text.trim(),
        language: selectedLanguage
      });

      if (response.success) {
        if (response.model) {
          setActiveModel(response.model);
        }
        if (response.suggestedQuestions && response.suggestedQuestions.length > 0) {
          setSuggestedQuestions(response.suggestedQuestions);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: response.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSimulated: response.isSimulated
          }
        ]);
      } else {
        setErrorMessage(response.message || 'Unable to generate response from AI server');
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            sender: 'ai',
            text: response.reply || "I had a little trouble connecting just now. Please try again in a moment.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSimulated: true
          }
        ]);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = async () => {
    const newConvId = await aiChatService.createConversation(selectedLanguage);
    if (newConvId) setConversationId(newConvId);

    setMessages([
      {
        id: `m-${Date.now()}`,
        sender: 'ai',
        text: getKhushiWelcome(selectedLanguage),
        time: 'Just now',
        isSimulated: false
      }
    ]);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Top Banner Status */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-800 via-primary-700 to-primary-600 text-white px-4 sm:px-5 py-3 rounded-2xl flex items-center justify-between gap-3 mb-4 shadow-md shadow-primary-800/15">
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-secondary/20 pointer-events-none" />
        <div className="relative flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
            <img src="/kv-horizontal-logo.png" alt="Kshitij Vivan" className="h-9 w-auto max-w-[145px] object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-300">Khushi · KV Course Guide</div>
            <div className="text-xs sm:text-sm leading-snug text-white/90">Friendly creative course guidance in English, Hindi, Hinglish, or Gujarati.</div>
          </div>
        </div>
        <div className="relative shrink-0">
          <Badge className="gap-1.5 border border-white/20 bg-white/10 text-[10px] text-white shadow-none hover:bg-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary-300" />
            {activeModel.includes('Local') ? 'Local guide' : activeModel.includes('Google') ? 'AI connected' : activeModel.includes('Verified') ? 'KV course facts' : 'Ready'}
          </Badge>
        </div>
      </div>

      {health?.database && health.database.status !== 'connected' && (
        <div className="flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 mb-4 text-xs text-slate-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-secondary-600" />
          <p>
            Khushi can still guide you here, but callback requests will not reach KV admissions until its database is connected.
            {health.database.status === 'schema_missing' ? ' The required database tables have not been installed yet.' : ''}
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2 rounded-xl text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Panel: Sidebar (Conversations, Language, Support) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col bg-white rounded-2xl border border-primary-100 shadow-md shadow-primary-900/5 p-4 overflow-hidden">
          {/* Header Brand */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-900">Kshitij Vivan</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
              className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600 border-slate-200"
              title="New Conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* New Chat Button */}
          <Button
            onClick={clearConversation}
            className="w-full mt-3 gap-2 text-xs font-semibold h-9 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Start New Session
          </Button>

          {/* Recent Conversations */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2 px-1">
                Explore a course
            </span>
            {courseQuestions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSendMessage(`Tell me about the ${session.title} course`)}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all text-xs group"
              >
                <div className="font-medium text-slate-800 truncate group-hover:text-primary">
                  {session.title}
                </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{session.detail}</div>
              </button>
            ))}
          </div>

          {/* Help & Support Card */}
          <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 mb-1">
              <HelpCircle className="w-4 h-4 text-primary" />
              <span>Talk with a KV counsellor</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
              {health?.database?.status === 'connected'
                ? 'Khushi can request a callback if you want one. Sharing contact details is optional.'
                : 'Callback requests are not connected yet. Khushi can still help you explore courses here.'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSendMessage("I would like a Kshitij Vivan counsellor to call me.")}
              className="w-full text-xs h-7 bg-white"
            >
              {health?.database?.status === 'connected' ? 'Request Callback' : 'Check Callback Availability'}
            </Button>
          </div>
        </div>

        {/* Main Panel: Chat or Voice Interface */}
        <div className="lg:col-span-9 flex flex-col h-full min-h-0">
          {mode === 'voice' ? (
            <VoiceCounsellingView
              onSwitchToChat={() => setMode('chat')}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              conversationId={conversationId}
              onNewMessageFromVoice={(userText, aiText) => {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `u-${Date.now()}`,
                    sender: 'user',
                    text: userText,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  },
                  {
                    id: `ai-${Date.now() + 1}`,
                    sender: 'ai',
                    text: aiText,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }}
            />
          ) : (
            <div className="flex flex-col h-full bg-white rounded-2xl border border-primary-100 shadow-lg shadow-primary-900/5 overflow-hidden">
              {/* Conversation Top Header */}
              <div className="p-4 border-b border-primary-100/80 flex items-center justify-between bg-gradient-to-r from-white via-white to-primary-50/60">
                <div className="flex items-center gap-3">
                  <AIAvatar size="md" isSpeaking={isTyping} />
                  <div>
                    <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">Khushi · KV Course Guide</h3>
                      <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span> Here to help
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Kshitij Vivan · Ahmedabad</p>
                  </div>
                </div>

                {/* Right controls: Mode Switch & Clear */}
                <div className="flex items-center gap-2">
                  <LanguageSelector
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={setSelectedLanguage}
                  />
                  <div className="flex items-center bg-primary-50/80 p-0.5 rounded-lg border border-primary-100">
                    <button
                      type="button"
                      onClick={() => setMode('chat')}
                      className="px-2 sm:px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all bg-white text-primary shadow-sm"
                      title="Chat mode"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('voice')}
                      className="px-2 sm:px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-600 hover:text-slate-900"
                      title="Voice mode"
                    >
                      <Headphones className="w-3.5 h-3.5 text-secondary" /><span className="hidden sm:inline">Voice</span>
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearConversation}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600"
                    title="Clear Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Chat Message Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F7FAFA] space-y-4">
                {/* Welcome Card Box */}
                <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-[#FFF8E8] p-5 rounded-2xl border border-primary-100 mb-6 shadow-sm">
                  <div className="absolute right-0 top-0 h-1 w-24 bg-gradient-to-l from-secondary to-secondary-300 rounded-bl-full" />
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Let’s find the right creative course for you</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        We can take it one small step at a time. Ask about the courses, tools, learning format, or fees—or tell me what you hope to create.
                      </p>
                    </div>
                  </div>

                  {/* Suggested Question Pills */}
                  <div className="grid sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-primary-100/60">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(q)}
                        className="text-left text-xs bg-white hover:bg-primary-50 text-slate-700 hover:text-primary font-medium p-2.5 rounded-xl border border-slate-200/80 hover:border-primary/30 transition-all flex items-center justify-between shadow-2xs group"
                      >
                        <span className="truncate">{q}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary flex-shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Bubble Feed */}
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    sender={msg.sender}
                    text={msg.text}
                    time={msg.time}
                    isSimulated={Boolean(msg.isSimulated)}
                  />
                ))}

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 w-28 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
                    <span className="text-[10px] text-slate-400 ml-1">typing</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Bottom Bar */}
              <div className="p-3 sm:p-4 bg-white border-t border-primary-100/80">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setMode('voice')}
                    className="h-10 w-10 text-slate-500 hover:text-primary rounded-xl flex-shrink-0"
                    title="Switch to Voice Mode"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>

                  <div className="flex-1 relative">
                    <textarea
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Ask Khushi about courses, tools, fees, or duration…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary max-h-32 shadow-2xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!inputVal.trim() || isTyping}
                    className="h-10 px-4 rounded-xl gap-1.5 text-xs font-semibold shadow-sm flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </form>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                  <span>Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] border border-slate-200">Enter</kbd> to send</span>
                  <span className="text-primary-700 font-medium">Khushi · {selectedLanguage === 'hi' ? 'हिन्दी' : selectedLanguage === 'gu' ? 'ગુજરાતી' : selectedLanguage === 'hinglish' ? 'Hinglish' : 'English'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
