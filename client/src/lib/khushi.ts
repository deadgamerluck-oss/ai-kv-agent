import { SupportedLanguage } from '@/types/models';

export const getKhushiWelcome = (language: SupportedLanguage): string => {
  switch (language) {
    case 'hi':
      return 'नमस्ते! मैं खुशी, Kshitij Vivan की course guide हूँ। KV में students practical training और projects से creative skills सीखते हैं। पहले बताइए, मैं आपको किस नाम से बुलाऊँ?';
    case 'hinglish':
      return 'Hi! Main Khushi, Kshitij Vivan ki course guide hoon. KV mein students practical training aur projects se creative skills seekhte hain. Pehle batao, main aapko kis naam se bulaun?';
    case 'gu':
      return 'નમસ્તે! હું ખુશી, Kshitij Vivan ની course guide છું. KV માં વિદ્યાર્થીઓ practical training અને projects દ્વારા creative skills શીખે છે. પહેલાં કહો, હું તમને કયા નામથી બોલાવું?';
    default:
      return "Hi! I'm Khushi, your course guide at Kshitij Vivan. KV helps learners build creative skills through practical training and projects. What would you like me to call you?";
  }
};

export const getKhushiSuggestions = (language: SupportedLanguage): string[] => {
  switch (language) {
    case 'hi':
      return ['मुझे Graphic Design सीखना है', 'मैं Video Editing के बारे में जानना चाहता/चाहती हूँ', 'Graphic & Video Editing में क्या सिखाते हैं?', 'UI/UX Design क्या होता है?'];
    case 'hinglish':
      return ['Mujhe Graphic Design seekhna hai', 'Video Editing ke baare mein batao', 'Graphic & Video Editing mein kya sikhate ho?', 'UI/UX Design kya hota hai?'];
    case 'gu':
      return ['મારે Graphic Design શીખવું છે', 'Video Editing વિશે જણાવો', 'Graphic & Video Editing માં શું શીખવાય છે?', 'UI/UX Design શું છે?'];
    default:
      return ['I want to learn Graphic Design', 'Tell me about Video Editing', 'What is in the Graphic & Video course?', 'What does UI/UX Design include?'];
  }
};
