import { getGeminiClient } from './geminiService';
import { config } from '../../config';
import { buildCounsellorSystemPrompt, StudentContext } from '../prompts/counsellorPrompt';
import { getVerifiedCoursesKnowledge, VerifiedCourseKnowledge } from './courseKnowledgeService';

export interface GenerateChatResponseParams {
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  studentContext?: StudentContext;
  conversationSummary?: string;
  preferredLanguage?: string;
  callbackDeliveryAvailable?: boolean;
  responseChannel?: 'chat' | 'voice';
}

export interface ChatEngineResult {
  reply: string;
  model: string;
  isSimulated: boolean;
  tokensUsed?: number;
}

const responseLanguage = (message: string, preferredLanguage?: string): 'en' | 'hi' | 'hinglish' | 'gu' => {
  if (/[\u0A80-\u0AFF]/u.test(message)) return 'gu';
  if (/[\u0900-\u097F]/u.test(message)) return 'hi';
  if (preferredLanguage === 'hinglish') return 'hinglish';
  if (preferredLanguage === 'gu' || preferredLanguage === 'hi') return preferredLanguage;
  if (/\b(main|mujhe|mera|aap|kya|kaise|hai|haan|karna|batao|nahi)\b/i.test(message)) return 'hinglish';
  return 'en';
};

const say = (language: 'en' | 'hi' | 'hinglish' | 'gu', en: string, hi: string, hinglish: string, gu: string): string => {
  if (language === 'hi') return hi;
  if (language === 'hinglish') return hinglish;
  if (language === 'gu') return gu;
  return en;
};

const courseOverview = (course: VerifiedCourseKnowledge, language: 'en' | 'hi' | 'hinglish' | 'gu'): string => {
  const descriptions: Record<string, Record<'en' | 'hi' | 'hinglish' | 'gu', string>> = {
    'kv-graphic-design': {
      en: 'It covers branding, print and advertising design, packaging, social media graphics, and digital artwork.',
      hi: 'इसमें branding, print और advertising design, packaging, social media graphics और digital artwork शामिल हैं।',
      hinglish: 'Isme branding, print aur advertising design, packaging, social media graphics aur digital artwork cover hote hain.',
      gu: 'આમાં branding, print અને advertising design, packaging, social media graphics અને digital artwork સામેલ છે.'
    },
    'kv-video-editing': {
      en: 'It covers AI and cinematic editing, Reels, Shorts, wedding films, and social media videos.',
      hi: 'इसमें AI और cinematic editing, Reels, Shorts, wedding films और social media videos शामिल हैं।',
      hinglish: 'Isme AI aur cinematic editing, Reels, Shorts, wedding films aur social media videos cover hote hain.',
      gu: 'આમાં AI અને cinematic editing, Reels, Shorts, wedding films અને social media videos સામેલ છે.'
    },
    'kv-graphics-video': {
      en: 'It combines graphic design and video editing, including branding, print, social graphics, video, audio, motion graphics, and AI tools.',
      hi: 'यह graphic design और video editing को जोड़ता है—branding, print, social graphics, video, audio, motion graphics और AI tools के साथ।',
      hinglish: 'Ye graphic design aur video editing dono cover karta hai—branding, print, social graphics, video, audio, motion graphics aur AI tools.',
      gu: 'આ course graphic design અને video editing બંને શીખવે છે—branding, print, social graphics, video, audio, motion graphics અને AI tools સાથે.'
    },
    'kv-ui-ux': {
      en: 'It covers app and web design, game UI, reusable components, icons, logos, prototyping, motion, and AI-assisted design.',
      hi: 'इसमें app और web design, game UI, components, icons, logos, prototyping, motion और AI-assisted design शामिल हैं।',
      hinglish: 'Isme app aur web design, game UI, components, icons, logos, prototyping, motion aur AI-assisted design cover hote hain.',
      gu: 'આમાં app અને web design, game UI, components, icons, logos, prototyping, motion અને AI-assisted design સામેલ છે.'
    }
  };
  return descriptions[course.slug]?.[language] || course.shortDescription;
};

const courseTools = (course: VerifiedCourseKnowledge, language: 'en' | 'hi' | 'hinglish' | 'gu'): string => {
  if (course.slug === 'kv-graphics-video') {
    return say(language,
      'The combined deck does not list software names individually. It covers graphic design and video editing; I can share the named tools for either separate course.',
      'Combined course deck में software के नाम अलग-अलग नहीं दिए हैं। इसमें graphic design और video editing शामिल हैं। मैं दोनों में से किसी एक course के named tools बता सकती हूँ।',
      'Combined course deck mein software ke names alag se nahi diye. Isme graphic design aur video editing hai. Main individual course ke tools bata sakti hoon.',
      'Combined course deck માં software ના નામ અલગથી નથી. તેમાં graphic design અને video editing છે. હું individual course ના tools જણાવી શકું.');
  }
  const toolsByCourse: Record<string, string> = {
    'kv-graphic-design': 'Photoshop, Illustrator, CorelDRAW, InDesign, Adobe Firefly, ChatGPT, and other AI tools',
    'kv-video-editing': 'Premiere Pro, Audition, After Effects, Photoshop, Adobe Firefly, and AI tools',
    'kv-ui-ux': 'Figma, Photoshop, Illustrator, CorelDRAW, InDesign, Premiere Pro, After Effects, Adobe Firefly, ChatGPT, and AI tools'
  };
  const tools = toolsByCourse[course.slug] || course.fullDescription || 'the course tools listed by KV';
  return say(language,
    `You will practise with ${tools}. The course also includes assignments and portfolio work.`,
    `Course में ${tools} जैसे tools का practical अभ्यास, assignments और portfolio work शामिल हैं।`,
    `Course mein ${tools} jaise tools ke saath practice, assignments aur portfolio work hoga.`,
    `Course માં ${tools} જેવા tools સાથે practice, assignments અને portfolio work સામેલ છે.`);
};

const findCourse = (query: string, courses: VerifiedCourseKnowledge[]): VerifiedCourseKnowledge | undefined => {
  const text = query.toLowerCase();
  if (/graphic\s*(?:&|and)\s*video|graphics\s*(?:&|and)\s*video/.test(text)) return courses.find((course) => course.slug === 'kv-graphics-video');
  if (/ui\s*\/?\s*ux|user experience/.test(text)) return courses.find((course) => course.slug === 'kv-ui-ux');
  if (/video|reel|shorts|premiere|wedding film/.test(text)) return courses.find((course) => course.slug === 'kv-video-editing');
  if (/graphic|photoshop|illustrator|branding|logo/.test(text)) return courses.find((course) => course.slug === 'kv-graphic-design');
  return undefined;
};

const makeLocalReply = (
  message: string,
  language: 'en' | 'hi' | 'hinglish' | 'gu',
  courses: VerifiedCourseKnowledge[],
  context: StudentContext,
  callbackDeliveryAvailable = false,
  responseChannel: 'chat' | 'voice' = 'chat'
): string => {
  const course = findCourse(`${message} ${(context.courseInterests || []).join(' ')}`, courses);
  const asksFee = /\b(fee|fees|price|cost|how much)\b|ફી|કિંમત|फीस|कितना/i.test(message);
  const asksDuration = /\b(duration|how long|course length|months|month)\b|કેટલો સમય|કેટલા મહિના|कितने महीने|कितना समय/i.test(message);
  const asksEligibility = /eligib|qualif|who can join|પાત્રતા|લાયકાત|योग्यता|कौन कर सकता/i.test(message);
  const asksCourse = /course|teach|learn|module|software|tool|syllabus|સીખ|शिख|सिख|पढ़|पढ़|કોર્સ/i.test(message);
  const asksPlacement = /placement|job|hiring|salary|career|freelance|નોકરી|રોજગાર|પ્લેસમેન્ટ|नौकरी|प्लेसमेंट|करियर/i.test(message);
  const asksScholarship = /scholarship|financial aid|fee discount|સ્કોલરશિપ|આર્થિક સહાય|छात्रवृत्ति|स्कॉलरशिप/i.test(message);
  const declinesCallback = context.callbackDeclined && /^(no|no thanks|no thank you|not now|don't|do not|nah|nahi|nahin|नहीं|जी नहीं|अभी नहीं|ના|નહીં|નહિ)(?:[,.!\s]|$)/iu.test(message.trim());
  const asksCallback = context.callbackRequested || /callback|call me|please call|speak to|talk to.*counsell|કૉલ|કાઉન્સેલર|कॉल|काउंसलर/i.test(message);
  const greeting = /^(hi|hello|hey|namaste|નમસ્તે|नमस्ते|हाय)[!.\s]*$/i.test(message.trim());
  const displayName = context.fullName ? `, ${context.fullName}` : '';

  if (asksCallback) {
    if (!callbackDeliveryAvailable) {
      return say(language,
        'I’m sorry, the KV admissions callback service is not connected right now, so I cannot submit a callback request. Please do not share contact details for a callback yet; I can still help you explore courses here.',
        'माफ़ कीजिए, KV admissions callback सेवा अभी जुड़ी नहीं है, इसलिए मैं callback request नहीं भेज सकती। अभी callback के लिए contact details साझा न करें; मैं यहाँ courses समझने में मदद कर सकती हूँ।',
        'Sorry, KV admissions callback service abhi connected nahi hai, isliye main callback request submit nahi kar sakti. Abhi callback ke liye contact details share na karein; main yahin courses samjha sakti hoon.',
        'માફ કરશો, KV admissions callback સેવા અત્યારે જોડાયેલી નથી, તેથી હું callback request મોકલી શકતી નથી. અત્યારે callback માટે contact details ન આપશો; હું અહીં courses સમજવામાં મદદ કરી શકું.');
    }
    if (!context.callbackConsentGiven) {
      return say(language,
        `Of course${displayName}. I can ask the Kshitij Vivan admissions team to contact you. May I share the contact details you choose to provide only to arrange that call?`,
        `ज़रूर${displayName}। मैं Kshitij Vivan admissions team से आपके लिए call arrange कर सकती हूँ। क्या मैं आपकी दी हुई contact details सिर्फ़ इस call के लिए team से share करूँ?`,
        `Bilkul${displayName}. Main Kshitij Vivan admissions team se aapke liye call arrange karwa sakti hoon. Kya main aapki di hui contact details sirf isi call ke liye team ke saath share karun?`,
        `હા, જરૂર${displayName}. હું Kshitij Vivan admissions team સાથે તમારા માટે call ગોઠવી શકું છું. તમે આપેલી contact details ફક્ત આ call માટે team સાથે share કરું?`);
    }
    if (!context.phone && !context.email) {
      return say(language,
        'What is the best phone or WhatsApp number for the counsellor to reach you? You can skip this if you prefer.',
        'काउंसलर आपसे किस phone या WhatsApp number पर बात कर सकते हैं? आप चाहें तो इसे छोड़ सकते हैं।',
        'Counsellor aapse kis phone ya WhatsApp number par baat kar sakte hain? Aap chahein to isse skip kar sakte hain.',
        'Counsellor કયા phone અથવા WhatsApp number પર તમારો સંપર્ક કરી શકે? તમે ઇચ્છો તો આ વિગતો છોડો.');
    }
    return say(language,
      'Thank you. I have noted the contact detail you chose to share in this conversation for your callback request. I cannot confirm a call time here. Is there anything else you would like help with?',
      'धन्यवाद। Callback request के लिए आपने जो contact detail दी है, उसे मैंने इस बातचीत में note किया है। मैं यहाँ call का समय confirm नहीं कर सकती। क्या मैं किसी और चीज़ में मदद करूँ?',
      'Thanks. Callback request ke liye aapki di hui contact detail maine is conversation mein note ki hai. Main yahan call ka time confirm nahi kar sakti. Kya main kisi aur cheez mein help karun?',
      'આભાર. Callback request માટે તમે આપેલી contact detail મેં આ વાતચીતમાં નોંધેલી છે. હું અહીં call નો સમય નક્કી કરી શકતી નથી. બીજી કોઈ મદદ કરું?');
  }

  if ((context.contactDetailsProvided || context.phone || context.email) && !context.callbackConsentGiven && !context.callbackDeclined) {
    if (!callbackDeliveryAvailable) {
      return say(language,
        'Thanks for sharing. KV admissions is not connected here, so I will not pass your details on. You can keep exploring courses without sharing any contact details.',
        'बताने के लिए धन्यवाद। यहाँ KV admissions जुड़ा नहीं है, इसलिए मैं आपकी details आगे share नहीं करूँगी। आप बिना contact details दिए courses देख सकते हैं।',
        'Share karne ke liye thanks. Yahan KV admissions connected nahi hai, isliye main aapki details aage share nahi karungi. Aap bina contact details diye courses explore kar sakte ho.',
        'આભાર. અહીં KV admissions જોડાયેલું નથી, તેથી હું તમારી વિગતો આગળ share નહીં કરું. તમે contact details આપ્યા વિના courses જોઈ શકો છો.');
    }
    return say(language,
      'Thanks for sharing that. I will not pass it to anyone unless you ask me to arrange a callback. Would you like a counsellor to contact you?',
      'यह बताने के लिए धन्यवाद। आपकी अनुमति के बिना मैं इसे किसी से share नहीं करूँगी। क्या आप चाहेंगे कि counsellor आपसे संपर्क करें?',
      'Share karne ke liye thanks. Aapki permission ke bina main ise kisi ko nahi bhejungi. Kya aap chahte hain ki counsellor aapse contact karein?',
      'આભાર. તમારી મંજૂરી વિના હું આ વિગતો કોઈને share નહીં કરું. શું તમે ઇચ્છો છો કે counsellor તમારો સંપર્ક કરે?');
  }

  if (asksFee) {
    const relevant = course ? [course] : courses;
    const feeLines = relevant.map((item) => `${responseChannel === 'voice' ? '' : '• '}${item.name}: ${item.fees}`).join(responseChannel === 'voice' ? '; ' : '\n');
    const feePresentation = responseChannel === 'voice' ? `${feeLines}.` : feeLines;
    return say(language,
      `${feePresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}These are the fees shown in the supplied course decks; please confirm the current amount with admissions. Which course are you considering?`,
      `${feePresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}ये रकम दिए गए course decks में लिखी हैं; current fees admissions team से confirm कर लें। आप किस course के बारे में सोच रहे हैं?`,
      `${feePresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}Ye fees shared course decks mein di gayi hain; current amount admissions team se confirm kar lena. Aap kis course ke baare mein soch rahe ho?`,
      `${feePresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}આ fees આપેલા course decks માં દર્શાવેલી છે; હાલની રકમ admissions team પાસે confirm કરશો. તમે કયા course વિશે વિચારો છો?`);
  }

  if (asksEligibility) {
    return say(language,
      'The course decks do not list eligibility requirements, so I do not want to guess. What are you studying now or what have you completed? I can pass that question to the KV admissions team.',
      'Course decks में eligibility नहीं दी गई है, इसलिए मैं अंदाज़ा नहीं लगाऊँगी। आप अभी क्या पढ़ रहे हैं या क्या पूरा किया है? मैं यह बात KV admissions team से confirm कर सकती हूँ।',
      'Course decks mein eligibility mention nahi hai, isliye main guess nahi karungi. Aap abhi kya padh rahe ho ya kya complete kiya hai? Main KV admissions team se confirm kar sakti hoon.',
      'Course decks માં eligibility લખેલી નથી, તેથી હું અંદાજ નહીં લગાવું. તમે હાલમાં શું ભણો છો અથવા શું પૂરું કર્યું છે? હું KV admissions team પાસે પુષ્ટિ કરી શકું.');
  }

  if (asksDuration) {
    if (course) {
      return say(language,
        `${course.name} runs for ${course.duration}. Would you like me to explain what is covered during that time?`,
        `${course.name} ${course.duration} का है। क्या आप जानना चाहेंगे कि इस दौरान क्या सिखाया जाता है?`,
        `${course.name} ${course.duration} ka hai. Kya aap jaana chahoge ki is dauraan kya sikhaya jaata hai?`,
        `${course.name} ${course.duration} નો છે. આ સમય દરમિયાન શું શીખવાય છે તે જાણવું છે?`);
    }
    const durationLines = courses.map((item) => `${responseChannel === 'voice' ? '' : '• '}${item.name}: ${item.duration}`).join(responseChannel === 'voice' ? '; ' : '\n');
    const durationPresentation = responseChannel === 'voice' ? `${durationLines}.` : durationLines;
    return say(language,
      `Here are the durations listed in the KV course decks: ${durationPresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}Which course would you like to explore?`,
      `KV course decks में दी गई अवधि: ${durationPresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}आप किस course के बारे में जानना चाहेंगे?`,
      `KV course decks mein duration: ${durationPresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}Aap kis course ke baare mein jaana chahoge?`,
      `KV course decks માં દર્શાવેલો સમય: ${durationPresentation}${responseChannel === 'voice' ? ' ' : '\n\n'}તમે કયા course વિશે જાણવા માંગો છો?`);
  }

  if (asksPlacement) {
    return say(language,
      'KV’s materials describe practical projects, portfolio work, grooming, and placement assistance, and cite 700+ hiring partners. That is support, not a job guarantee. Which creative role interests you?',
      'KV की सामग्री में practical projects, portfolio work, grooming और placement assistance का ज़िक्र है; 700+ hiring partners भी बताए गए हैं। यह support है, job guarantee नहीं। आपको कौन-सा creative role पसंद है?',
      'KV ke materials mein practical projects, portfolio work, grooming aur placement assistance ka zikr hai; 700+ hiring partners bhi diye hain. Ye support hai, job guarantee nahi. Aapko kaunsa creative role pasand hai?',
      'KV ની સામગ્રીમાં practical projects, portfolio work, grooming અને placement assistance છે અને 700+ hiring partners જણાવ્યા છે. આ સહાય છે, job guarantee નથી. તમને કઈ creative role ગમે છે?');
  }

  if (asksScholarship) {
    return say(language,
      'The supplied KV course decks do not list scholarship or financial-aid details, so I do not want to guess. Would you like me to ask the KV admissions team?',
      'दिए गए KV course decks में scholarship की जानकारी नहीं है, इसलिए मैं अंदाज़ा नहीं लगाऊँगी। क्या आप चाहेंगे कि मैं KV admissions team से पूछूँ?',
      'KV course decks mein scholarship details nahi hain, isliye main guess nahi karungi. Kya main KV admissions team se poochun?',
      'KV course decks માં scholarship ની વિગતો નથી, તેથી હું અંદાજ નહીં લગાવું. શું હું KV admissions team ને પૂછી આપું?');
  }

  if (declinesCallback) {
    return say(language,
      'Of course. I will not share your contact details or arrange a callback. We can keep exploring courses here. What would you like to know?',
      'बिल्कुल। मैं आपकी contact details share नहीं करूँगी और callback arrange नहीं करूँगी। हम यहीं courses देख सकते हैं। आप क्या जानना चाहेंगे?',
      'Bilkul. Main aapki contact details share nahi karungi aur callback arrange nahi karungi. Hum yahin courses dekh sakte hain. Aap kya jaana chahoge?',
      'ચોક્કસ. હું તમારી contact details share નહીં કરું અને callback ગોઠવીશ નહીં. આપણે અહીં course વિશે વાત કરી શકીએ. તમે શું જાણવા માંગો છો?');
  }

  if (asksCourse && course) {
    const asksTools = /tool|software|app|program|which.*use|સોફ્ટવેર|ટૂલ|सॉफ्टवेयर|टूल/i.test(message);
    if (asksTools) {
      return say(language,
        `${course.name} is ${course.duration}. ${courseTools(course, language)} Would you like me to explain the course projects or compare its learning modes?`,
        `${course.name} ${course.duration} का course है। ${courseTools(course, language)} क्या आप इसके projects समझना चाहेंगे या learning modes की तुलना?`,
        `${course.name} ${course.duration} ka course hai. ${courseTools(course, language)} Aap projects samajhna chahoge ya learning modes compare karein?`,
        `${course.name} ${course.duration} નો course છે. ${courseTools(course, language)} તમે projects સમજવા માંગો છો કે learning modes સરખાવીએ?`);
    }
    return say(language,
      `${course.name} is ${course.duration}. ${courseOverview(course, language)} The deck lists ${course.fees}. Would you like to hear about the tools or the learning format?`,
      `${course.name} ${course.duration} का course है। ${courseOverview(course, language)} Deck में ${course.fees} लिखी हैं। क्या आप tools या learning format के बारे में जानना चाहेंगे?`,
      `${course.name} ${course.duration} ka course hai. ${courseOverview(course, language)} Deck mein ${course.fees} diye hain. Aap tools ya learning format ke baare mein jaana chahoge?`,
      `${course.name} ${course.duration} નો course છે. ${courseOverview(course, language)} Deck માં ${course.fees} દર્શાવેલી છે. તમને tools કે learning format વિશે જાણવું છે?`);
  }

  if (asksCourse) {
    const courseList = courses.map((item) => `${responseChannel === 'voice' ? '' : '• '}${item.name} (${item.duration})`).join(responseChannel === 'voice' ? ', ' : '\n');
    const coursePresentation = courseList;
    return say(language,
      `KV's course decks list these four creative programmes: ${coursePresentation}${responseChannel === 'voice' ? '. ' : '\n\n'}Which one sounds closest to what you want to learn?`,
      `KV के course decks में ये चार creative programmes हैं: ${coursePresentation}${responseChannel === 'voice' ? '. ' : '\n\n'}आप इनमें से किसके बारे में जानना चाहेंगे?`,
      `KV ke course decks mein ye chaar creative programmes hain: ${coursePresentation}${responseChannel === 'voice' ? '. ' : '\n\n'}Aap inmein se kis course ke baare mein jaana chahoge?`,
      `KV ના course decks માં આ ચાર creative programmes છે: ${coursePresentation}${responseChannel === 'voice' ? '. ' : '\n\n'}તમને કયા course વિશે જાણવું છે?`);
  }

  if (greeting) {
    return say(language,
      "Hi! I'm Khushi from Kshitij Vivan. I can explain the courses step by step. What would you like me to call you?",
      'नमस्ते! मैं Kshitij Vivan से खुशी हूँ। मैं courses को आसान तरीके से समझा सकती हूँ। मैं आपको किस नाम से बुलाऊँ?',
      'Hi! Main Kshitij Vivan se Khushi hoon. Main courses aapko step by step samjhaungi. Main aapko kis naam se bulaun?',
      'નમસ્તે! હું Kshitij Vivan ની ખુશી છું. હું તમને courses સરળ રીતે સમજાવીશ. હું તમને કયા નામથી બોલાવું?');
  }

  if (!context.fullName) {
    return say(language,
      'I’m here to help you explore KV’s creative courses, one step at a time. What name would you like me to use?',
      'मैं KV के creative courses समझने में आपकी मदद करूँगी। पहले बताइए, मैं आपको किस नाम से बुलाऊँ?',
      'Main KV ke creative courses samajhne mein aapki help karungi. Pehle batao, main aapko kis naam se bulaun?',
      'હું KV ના creative courses સમજવામાં તમારી મદદ કરીશ. પહેલાં કહો, હું તમને કયા નામથી બોલાવું?');
  }

  if (!context.highestQualification && !context.currentEducation) {
    return say(language,
      `Thanks${displayName}. What are you studying now, or what have you completed?`,
      `धन्यवाद${displayName}। आप अभी क्या पढ़ रहे हैं या आपने क्या पूरा किया है?`,
      `Thanks${displayName}. Aap abhi kya padh rahe ho ya kya complete kiya hai?`,
      `આભાર${displayName}. તમે હાલમાં શું ભણો છો અથવા શું પૂરું કર્યું છે?`);
  }

  if (!context.courseInterests?.length) {
    return say(language,
      `Got it${displayName}. What would you most like to create: graphics, videos, both, or app and website designs?`,
      `समझ गई${displayName}। आपको क्या बनाना सबसे अच्छा लगेगा—graphics, videos, दोनों, या app और website designs?`,
      `Samajh gayi${displayName}. Aap kya banana pasand karoge—graphics, videos, dono, ya app aur website designs?`,
      `સમજાયું${displayName}. તમને શું બનાવવું ગમશે—graphics, videos, બંને, કે app અને website designs?`);
  }

  if (!context.careerGoals) {
    return say(language,
      `That helps${displayName}. Are you learning mainly for a job, freelance work, or personal interest?`,
      `यह मददगार है${displayName}। आप मुख्य रूप से job, freelance work या अपनी रुचि के लिए सीखना चाहते हैं?`,
      `Ye helpful hai${displayName}. Aap job, freelance work ya apni interest ke liye seekhna chahte ho?`,
      `આ જાણીને મદદ મળી${displayName}. તમે job, freelance work કે પોતાની રુચિ માટે શીખવા માંગો છો?`);
  }

  return say(language,
    `Thanks${displayName}. I can help you compare the course length, tools, and fees, and we can take it at your pace. What would you like to understand first?`,
    `धन्यवाद${displayName}। हम course duration, tools और fees को धीरे-धीरे समझ सकते हैं। आप पहले क्या जानना चाहेंगे?`,
    `Thanks${displayName}. Hum course duration, tools aur fees aaraam se compare kar sakte hain. Aap pehle kya samajhna chahoge?`,
    `આભાર${displayName}. આપણે course duration, tools અને fees શાંતિથી સરખાવી શકીએ. તમે પહેલાં શું સમજવા માંગો છો?`);
};

export const generateCounsellorReply = async (
  params: GenerateChatResponseParams
): Promise<ChatEngineResult> => {
  const verifiedCourses = await getVerifiedCoursesKnowledge();
  const callbackRequestInMessage = /callback|call me|call back|please call|speak to.*counsell|talk to.*counsell|કૉલ કરો|ફોન કરો|कॉल करें|काउंसलर से बात/i.test(params.userMessage);
  const verifiedFactRequest = /\b(fee|fees|price|cost|how much|duration|how long|tools?|software|eligib|qualif|scholarship|financial aid|placement|hiring|job guarantee)\b|ફી|કિંમત|પાત્રતા|લાયકાત|સ્કોલરશિપ|સોફ્ટવેર|ટૂલ|નોકરી|पात्रता|योग्यता|छात्रवृत्ति|प्लेसमेंट|नौकरी|सॉफ्टवेयर|टूल/i.test(params.userMessage);
  const contactFlow = Boolean(params.studentContext?.callbackRequested || params.studentContext?.callbackDeclined || params.studentContext?.callbackConsentGiven || params.studentContext?.contactDetailsProvided || callbackRequestInMessage);

  // Keep sensitive callback decisions and deck-backed course facts deterministic.
  // Gemini remains responsible for open-ended, personalized counselling.
  if (contactFlow || verifiedFactRequest) {
    return {
      reply: makeLocalReply(
        params.userMessage,
        responseLanguage(params.userMessage, params.preferredLanguage),
        verifiedCourses,
        params.studentContext || {},
        params.callbackDeliveryAvailable,
        params.responseChannel
      ),
      model: verifiedFactRequest ? 'KV Verified Course Info' : 'Khushi (Local course guide)',
      isSimulated: !verifiedFactRequest
    };
  }

  const systemPrompt = buildCounsellorSystemPrompt(
    verifiedCourses,
    params.studentContext,
    params.conversationSummary,
    params.responseChannel
  );

  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const contents = [
        ...params.conversationHistory.slice(-8).map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        { role: 'user', parts: [{ text: params.userMessage }] }
      ];

      const response = await gemini.models.generateContent({
        model: config.gemini.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
          maxOutputTokens: 320
        }
      });

      if (response.text?.trim()) {
        return { reply: response.text.trim(), model: `Google ${config.gemini.model}`, isSimulated: false };
      }
    } catch (geminiError) {
      console.error('[Gemini AI Engine Error]:', geminiError);
    }
  }

  return {
    reply: makeLocalReply(
      params.userMessage,
      responseLanguage(params.userMessage, params.preferredLanguage),
      verifiedCourses,
      params.studentContext || {},
    params.callbackDeliveryAvailable,
    params.responseChannel
    ),
    model: 'Khushi (Local course guide)',
    isSimulated: true
  };
};
