import { getSupabaseAdmin } from '../../config/supabase';

export interface VerifiedCourseKnowledge {
  id: string;
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  fullDescription: string | null;
  eligibility: string;
  duration: string;
  fees: string;
  learningMode: string;
  careerOpportunities: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export const getVerifiedCoursesKnowledge = async (): Promise<VerifiedCourseKnowledge[]> => {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_active', true);

    if (!error && data && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
        shortDescription: c.short_description,
        fullDescription: c.full_description,
        eligibility: c.eligibility,
        duration: c.duration,
        fees: c.fees,
        learningMode: c.learning_mode,
        careerOpportunities: Array.isArray(c.career_opportunities) ? c.career_opportunities : [],
        faqs: Array.isArray(c.frequently_asked_questions) ? c.frequently_asked_questions : []
      }));
    }
  }

  // Kshitij Vivan course facts from the supplied November 2026 counselling decks.
  return [
    {
      id: 'kv-graphic-design',
      name: '6 in 1 Graphic Design Course',
      slug: 'kv-graphic-design',
      category: 'Creative Design',
      shortDescription: 'A six-month creative course covering branding, print and advertising design, packaging, social media graphics, and digital artwork.',
      fullDescription: 'The deck lists Photoshop, Illustrator, CorelDRAW, InDesign, Adobe Firefly, ChatGPT, and AI tools. Students practise through assignments and portfolio work.',
      eligibility: 'Not specified in the supplied course deck. The Kshitij Vivan admissions team can confirm eligibility.',
      duration: '6 Months',
      fees: 'Offline: ₹60,000 total; Hybrid: ₹40,000 total (as listed in the supplied deck)',
      learningMode: 'Classroom or hybrid with live classes',
      careerOpportunities: ['Graphic Designer', 'Brand Identity Designer', 'Packaging Designer', 'Social Media Designer', 'Freelance Designer'],
      faqs: [
        { question: 'How long is the course?', answer: 'The deck lists a duration of six months.' },
        { question: 'What are the fees?', answer: 'The deck lists ₹60,000 for offline learning and ₹40,000 for hybrid learning. Please confirm current fees with admissions.' }
      ]
    },
    {
      id: 'kv-video-editing',
      name: '6 in 1 Video Editing Course',
      slug: 'kv-video-editing',
      category: 'Video & Motion',
      shortDescription: 'A six-month course in AI video editing, cinematic editing, Instagram Reels, YouTube Shorts, wedding films, and social media videos.',
      fullDescription: 'The deck lists Premiere Pro, Audition, After Effects, Photoshop, Adobe Firefly, and AI tools for editing, audio, motion graphics, captions, and visual creation.',
      eligibility: 'Not specified in the supplied course deck. The Kshitij Vivan admissions team can confirm eligibility.',
      duration: '6 Months',
      fees: 'Regular: ₹60,000 total; Hybrid: ₹40,000 total (as listed in the supplied deck)',
      learningMode: 'Classroom or hybrid with live classes',
      careerOpportunities: ['Video Editor', 'Reels and Shorts Editor', 'Wedding Video Editor', 'Motion Graphics Editor', 'Freelance Video Editor'],
      faqs: [
        { question: 'What kinds of videos are covered?', answer: 'The deck includes cinematic edits, Reels, Shorts, wedding films, and social media video.' },
        { question: 'What are the fees?', answer: 'The deck lists ₹60,000 for regular learning and ₹40,000 for hybrid learning. Please confirm current fees with admissions.' }
      ]
    },
    {
      id: 'kv-graphics-video',
      name: '12 in 1 Graphic & Video Course',
      slug: 'kv-graphics-video',
      category: 'Creative Design and Video',
      shortDescription: 'An eight-month combined course in graphic design and video editing, built around a 12-module portfolio.',
      fullDescription: 'The deck covers branding, print and publication, advertising, packaging, social graphics and digital design, alongside video editing, audio, motion graphics, and AI tools.',
      eligibility: 'Not specified in the supplied course deck. The Kshitij Vivan admissions team can confirm eligibility.',
      duration: '8 Months',
      fees: 'Regular: ₹1,20,000 total; Hybrid: ₹90,000 total (as listed in the supplied deck)',
      learningMode: 'Classroom or hybrid with live classes',
      careerOpportunities: ['Graphic Designer', 'Video Editor', 'Social Media Creative', 'Motion Graphics Editor', 'Freelance Creative'],
      faqs: [
        { question: 'What are the fees?', answer: 'The deck lists ₹1,20,000 for regular learning and ₹90,000 for hybrid learning. Please confirm current fees with admissions.' }
      ]
    },
    {
      id: 'kv-ui-ux',
      name: '12 in 1 UI/UX Design Course',
      slug: 'kv-ui-ux',
      category: 'UI/UX Design',
      shortDescription: 'An eleven-month course covering app and web design, game UI, components, icons, logos, prototyping, motion, and AI-assisted design.',
      fullDescription: 'The deck lists Figma, Photoshop, Illustrator, CorelDRAW, InDesign, Premiere Pro, After Effects, Adobe Firefly, ChatGPT, and AI tools.',
      eligibility: 'Not specified in the supplied course deck. The Kshitij Vivan admissions team can confirm eligibility.',
      duration: '11 Months',
      fees: 'Regular: ₹1,40,000 total; Hybrid: ₹1,00,000 total (as listed in the supplied deck)',
      learningMode: 'Classroom or hybrid with live classes',
      careerOpportunities: ['UI Designer', 'UX Designer', 'Product Designer', 'Prototype Designer', 'Freelance UI/UX Designer'],
      faqs: [
        { question: 'What does the course cover?', answer: 'The deck includes mobile apps, websites, games, UI components, prototyping, motion, and AI-assisted design.' },
        { question: 'What are the fees?', answer: 'The deck lists ₹1,40,000 for regular learning and ₹1,00,000 for hybrid learning. Please confirm current fees with admissions.' }
      ]
    }
  ];
};

/**
 * Formats course catalogue knowledge into a structured prompt context string.
 */
export const formatCoursesKnowledgeForPrompt = (courses: VerifiedCourseKnowledge[]): string => {
  return courses.map((c, i) => `
[Course ${i + 1}]
Name: ${c.name} (Code: ${c.slug})
Category: ${c.category}
Duration: ${c.duration}
Tuition Fees: ${c.fees}
Eligibility Criteria: ${c.eligibility}
Learning Mode: ${c.learningMode}
Summary: ${c.shortDescription}
Career Opportunities: ${c.careerOpportunities.join(', ')}
Key FAQs:
${c.faqs.map(f => `  Q: ${f.question} -> A: ${f.answer}`).join('\n')}
`).join('\n---\n');
};
