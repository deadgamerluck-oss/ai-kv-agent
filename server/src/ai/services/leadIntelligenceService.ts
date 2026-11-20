import { StudentContext } from '../prompts/counsellorPrompt';

export interface ExtractedIntelligence {
  extractedContext: Partial<StudentContext>;
  leadTemperature: 'hot' | 'warm' | 'cold';
  interestLevel: 'High' | 'Medium' | 'Low' | 'Undecided';
  admissionReadiness: 'Immediate' | 'Next Batch' | 'Next Year' | 'Researching';
  detectedLanguage: string;
  suggestedQuestions: string[];
  conversationStage: 'greeting' | 'qualification' | 'interests' | 'course_exploration' | 'fee_eligibility' | 'objections' | 'callback' | 'closed';
  callbackRequested: boolean;
  callbackConsentGiven: boolean;
  callbackDeclined: boolean;
}

const detectLanguage = (text: string, preferredLanguage = 'en'): string => {
  if (/[\u0A80-\u0AFF]/u.test(text)) return 'gu';
  if (/[\u0900-\u097F]/u.test(text)) return 'hi';

  const lower = text.toLowerCase();
  if (/\b(kem cho|majama|shu|tame|mane|maru|chhe|che|karvu|joie)\b/.test(lower)) return 'gu';
  if (/\b(main|mera|mujhe|mujhko|aap|tum|kya|kaise|hai|hain|hoon|chahta|chahti|karna|batao|nahi|haan)\b/.test(lower)) return 'hinglish';
  return ['en', 'hi', 'hinglish', 'gu'].includes(preferredLanguage) ? preferredLanguage : 'en';
};

const cleanName = (value: string): string => value
  .replace(/[.,!?;:]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .slice(0, 4)
  .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
  .join(' ');

const suggestedQuestions = (language: string): string[] => {
  switch (language) {
    case 'hi':
      return ['मुझे Graphic Design में क्या सिखाएँगे?', 'कौन-कौन से courses हैं?', 'मैं counsellor से बात करना चाहता/चाहती हूँ'];
    case 'hinglish':
      return ['Graphic Design mein kya sikhate ho?', 'Kaun-kaun se courses hain?', 'Mujhe counsellor se baat karni hai'];
    case 'gu':
      return ['Graphic Design માં શું શીખવાય છે?', 'કયા courses ઉપલબ્ધ છે?', 'મારે counsellor સાથે વાત કરવી છે'];
    default:
      return ['What will I learn in Graphic Design?', 'Which courses are available?', 'I would like to speak with a counsellor'];
  }
};

export const extractStudentIntelligence = async (
  lastUserMessage: string,
  existingContext: StudentContext,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  preferredLanguage = 'en'
): Promise<ExtractedIntelligence> => {
  // Keep extraction local so contact details are never sent to a second model call.
  const text = lastUserMessage.trim();
  const lower = text.toLowerCase();
  const priorAssistant = [...conversationHistory].reverse().find((message) => message.role === 'assistant')?.content || '';
  const assistantAskedName = /what would you like me to call you|what name should i use|your preferred name|your name|किस नाम से बुलाऊँ|કયા નામથી બોલાવું|maru naam|aapko kis naam/i.test(priorAssistant);
  const assistantAskedCallback = /would you like.*(callback|call|counsellor)|shall i arrange.*(call|counsell)|શું.*(કૉલ|કાઉન્સેલ)|क्या.*(कॉल|काउंसल)/i.test(priorAssistant);
  const assistantAskedContactShare = /may i share.*(detail|contact)|can i share.*(detail|contact)|contact details.*share|details.*share.*call|share kar(?:u|un)|what is the best phone|phone or whatsapp number|what number.*reach|કયા phone.*સંપર્ક|किस phone.*संपर्क|તમે.*share|તમારી.*share|શું હું.*share|શું.*તમારી મંજૂરી|क्या मैं.*share|क्या मैं.*अनुमति/i.test(priorAssistant);
  const affirmative = /^(yes|yeah|yep|sure|okay|ok|please|haan|han|ji|हाँ|हां|जी|ठीक है|હા|બરાબર|હા, જરૂર)(?:[,.!\s]|$)/iu.test(text);
  const negative = /^(no|no thanks|no thank you|not now|don't|do not|i don't|i do not|nah|nahi|nahin|नहीं|जी नहीं|अभी नहीं|ना|નહીં|નહિ)(?:[,.!\s]|$)/iu.test(text);

  const extractedContext: Partial<StudentContext> = {};

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0];
  if (email) extractedContext.email = email;

  const phone = text.match(/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/u)?.[0];
  if (phone) extractedContext.phone = phone.replace(/[\s-]/g, '');

  const explicitName = text.match(/(?:my name is|i am|i'm|this is|mera naam|main hoon|maru naam|મારું નામ(?: છે)?|मेरा नाम(?: है)?)[\s:,-]+([^,.!?\n]{1,60})/iu)?.[1];
  if (explicitName) {
    const name = cleanName(explicitName.replace(/\b(?:and|but|i am|i'm)\b.*$/i, ''));
    if (name && !/\d/.test(name)) extractedContext.fullName = name;
  } else {
    const candidate = text.replace(/[.,!?;:]+$/g, '').trim();
    const words = candidate.split(/\s+/);
    const looksLikeCourse = /graphic|design|video|editing|ui\/?ux|12th|10th|bca|b\.com|b\.sc|science|commerce|arts|class|student|graduate|yes|no|okay|ok|haan|હા|हाँ|हां/i.test(candidate);
    if (!existingContext.fullName && (assistantAskedName || conversationHistory.length === 0) && words.length <= 3 && !looksLikeCourse && !email && !phone && candidate.length <= 40) {
      extractedContext.fullName = cleanName(candidate);
    }
  }

  const education = text.match(/\b(?:class\s*)?(10th|10\s*th|ssc|class\s*12(?:th)?|12th|12\s*th|hsc|bca|b\.\s*com|bcom|b\.\s*sc|bsc|b\.\s*tech|btech|bachelor'?s?|mca|mba|graduate|postgraduate|diploma)\b/i)?.[0];
  if (education) {
    const normalized = education.toUpperCase().replace(/\s+/g, ' ').trim();
    extractedContext.highestQualification = normalized === '12 TH' || normalized === 'CLASS 12' ? 'Class 12th' : normalized === '10 TH' ? 'Class 10th' : normalized;
    extractedContext.currentEducation = text.slice(0, 100);
  }

  if (/\b(commerce|accounts)\b|વાણિજ્ય|કોમર્સ|कॉमर्स/i.test(text)) extractedContext.stream = 'Commerce';
  else if (/\b(science|pcm|pcb|pcmb)\b|વિજ્ઞાન|સાયન્સ|साइंस/i.test(text)) extractedContext.stream = 'Science';
  else if (/\b(arts|humanities)\b|આર્ટ્સ|કલા|आर्ट्स/i.test(text)) extractedContext.stream = 'Arts / Humanities';

  if (/\b(job|employment|work in a company|career)\b|નોકરી|કામ માટે|રોજગાર|नौकरी|जॉब|करियर|काम करना/i.test(text)) {
    extractedContext.careerGoals = 'Job / employment';
  } else if (/\b(freelanc(?:e|ing|er))\b|ફ્રીલાન્સ|ફ્રીલાન્સિંગ|फ्रीलांस/i.test(text)) {
    extractedContext.careerGoals = 'Freelance work';
  } else if (/\b(personal interest|hobby|for myself|for fun)\b|પોતાની રુચિ|શોખ માટે|अपने शौक|अपनी रुचि/i.test(text)) {
    extractedContext.careerGoals = 'Personal interest';
  }

  const courseMatches = [
    { pattern: /graphic\s*(?:&|and)\s*video|graphics\s*(?:&|and)\s*video|ગ્રાફિક.*વિડિયો|ग्राफिक.*वीडियो/i, course: '12 in 1 Graphic & Video Course' },
    { pattern: /ui\s*\/?\s*ux|user experience|ui-ux|યુઆઈ.*યુએક્સ|यूआई.*यूएक्स/i, course: '12 in 1 UI/UX Design Course' },
    { pattern: /video editing|video editor|premiere pro|reels|shorts|વીડિયો|वीडियो|રીલ્સ/i, course: '6 in 1 Video Editing Course' },
    { pattern: /graphic design|graphics|photoshop|illustrator|ગ્રાફિક|ग्राफिक/i, course: '6 in 1 Graphic Design Course' }
  ].find((item) => item.pattern.test(text));
  if (courseMatches) {
    const previous = existingContext.courseInterests || [];
    extractedContext.courseInterests = Array.from(new Set([...previous, courseMatches.course]));
  }

  const location = text.match(/(?:i live in|i am from|i'm from|from|city is|શહેર|મારું શહેર|मैं .*से हूँ|मेरा शहर)\s+([^,.!?\n]{2,40})/i)?.[1];
  if (location) extractedContext.location = cleanName(location);

  const asksForCall = /\b(call me|please call|callback|call back|want a call|speak to (?:a )?counsellor|talk to (?:a )?counsellor|કૉલ કરો|ફોન કરો|કાઉન્સેલર સાથે વાત|कॉल करें|मुझे कॉल|काउंसलर से बात|baat karni|call karna)\b/i.test(text);
  const callbackDeclined = Boolean(
    (negative && (assistantAskedCallback || assistantAskedContactShare)) ||
    (existingContext.callbackDeclined && !asksForCall && !affirmative)
  );
  const callbackRequested = callbackDeclined ? false : Boolean(existingContext.callbackRequested || asksForCall || (assistantAskedCallback && affirmative));
  const explicitlySharedForCallback = /you can share my (?:details|contact)|i consent|share my (?:number|email|details)|details share kar sakte|meri permission hai|તમે મારી વિગતો share કરી શકો|મંજૂરી આપું છું|मेरी details share कर सकते|अनुमति है/i.test(text);
  const callbackConsentGiven = !callbackDeclined && Boolean(
    existingContext.callbackConsentGiven ||
    (assistantAskedContactShare && affirmative) ||
    explicitlySharedForCallback ||
    (asksForCall && Boolean(phone || email))
  );

  const language = detectLanguage(text, preferredLanguage);
  const isWarm = Boolean(extractedContext.highestQualification || extractedContext.stream || extractedContext.courseInterests?.length);
  const isHot = callbackRequested || /\bready to enroll|want to enroll|start this batch|admission form\b/i.test(lower);
  const requestedFees = /\b(fee|fees|cost|price|budget)\b|ફી|ખર્ચ|फीस|खर्च/i.test(text);
  const askedEligibility = /eligib|qualif|who can join|પાત્રતા|લાયકાત|योग्यता|कौन कर सकता/i.test(text);
  const sharedContact = Boolean(existingContext.contactDetailsProvided || extractedContext.email || extractedContext.phone);

  return {
    extractedContext: {
      ...extractedContext,
      ...(sharedContact ? { contactDetailsProvided: true } : {}),
      callbackRequested,
      callbackConsentGiven,
      callbackDeclined
    },
    leadTemperature: isHot ? 'hot' : isWarm ? 'warm' : 'cold',
    interestLevel: isHot ? 'High' : isWarm ? 'Medium' : 'Undecided',
    admissionReadiness: isHot ? 'Next Batch' : 'Researching',
    detectedLanguage: language,
    suggestedQuestions: suggestedQuestions(language),
    conversationStage: callbackRequested ? 'callback' : requestedFees || askedEligibility ? 'fee_eligibility' : isWarm ? 'interests' : 'qualification',
    callbackRequested,
    callbackConsentGiven,
    callbackDeclined
  };
};
