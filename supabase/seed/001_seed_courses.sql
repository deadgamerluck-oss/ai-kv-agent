-- Kshitij Vivan course catalogue from the supplied November 2026 course decks.
INSERT INTO public.courses (
    name, slug, category, short_description, full_description, eligibility,
    duration, fees, learning_mode, career_opportunities,
    frequently_asked_questions, is_active
) VALUES
(
    '6 in 1 Graphic Design Course', 'kv-graphic-design', 'Creative Design',
    'A six-month course covering branding, print and advertising design, packaging, social media graphics, and digital artwork.',
    'The supplied deck lists Photoshop, Illustrator, CorelDRAW, InDesign, Adobe Firefly, ChatGPT, and AI tools, with practical assignments and portfolio work.',
    'Not specified in the supplied course deck. Please confirm eligibility with Kshitij Vivan admissions.',
    '6 Months', 'Offline: ₹60,000 total; Hybrid: ₹40,000 total (as listed in the supplied deck)',
    'Classroom or hybrid with live classes',
    '["Graphic Designer", "Brand Identity Designer", "Packaging Designer", "Social Media Designer", "Freelance Designer"]'::jsonb,
    '[{"question":"How long is the course?","answer":"The supplied deck lists six months."},{"question":"What are the fees?","answer":"The deck lists ₹60,000 offline and ₹40,000 hybrid; confirm current fees with admissions."}]'::jsonb,
    true
),
(
    '6 in 1 Video Editing Course', 'kv-video-editing', 'Video & Motion',
    'A six-month course in AI video editing, cinematic editing, Instagram Reels, YouTube Shorts, wedding films, and social media videos.',
    'The supplied deck lists Premiere Pro, Audition, After Effects, Photoshop, Adobe Firefly, and AI tools for editing, audio, motion graphics, captions, and visual creation.',
    'Not specified in the supplied course deck. Please confirm eligibility with Kshitij Vivan admissions.',
    '6 Months', 'Regular: ₹60,000 total; Hybrid: ₹40,000 total (as listed in the supplied deck)',
    'Classroom or hybrid with live classes',
    '["Video Editor", "Reels and Shorts Editor", "Wedding Video Editor", "Motion Graphics Editor", "Freelance Video Editor"]'::jsonb,
    '[{"question":"What kinds of videos are covered?","answer":"The deck includes cinematic edits, Reels, Shorts, wedding films, and social media video."},{"question":"What are the fees?","answer":"The deck lists ₹60,000 regular and ₹40,000 hybrid; confirm current fees with admissions."}]'::jsonb,
    true
),
(
    '12 in 1 Graphic & Video Course', 'kv-graphics-video', 'Creative Design and Video',
    'An eight-month combined course in graphic design and video editing, built around a 12-module portfolio.',
    'The supplied deck covers branding, print and publication, advertising, packaging, social graphics and digital design, alongside video editing, audio, motion graphics, and AI tools.',
    'Not specified in the supplied course deck. Please confirm eligibility with Kshitij Vivan admissions.',
    '8 Months', 'Regular: ₹1,20,000 total; Hybrid: ₹90,000 total (as listed in the supplied deck)',
    'Classroom or hybrid with live classes',
    '["Graphic Designer", "Video Editor", "Social Media Creative", "Motion Graphics Editor", "Freelance Creative"]'::jsonb,
    '[{"question":"How long is the combined course?","answer":"The deck lists eight months."},{"question":"What are the fees?","answer":"The deck lists ₹1,20,000 regular and ₹90,000 hybrid; confirm current fees with admissions."}]'::jsonb,
    true
),
(
    '12 in 1 UI/UX Design Course', 'kv-ui-ux', 'UI/UX Design',
    'An eleven-month course covering app and web design, game UI, components, icons, logos, prototyping, motion, and AI-assisted design.',
    'The supplied deck lists Figma, Photoshop, Illustrator, CorelDRAW, InDesign, Premiere Pro, After Effects, Adobe Firefly, ChatGPT, and AI tools.',
    'Not specified in the supplied course deck. Please confirm eligibility with Kshitij Vivan admissions.',
    '11 Months', 'Regular: ₹1,40,000 total; Hybrid: ₹1,00,000 total (as listed in the supplied deck)',
    'Classroom or hybrid with live classes',
    '["UI Designer", "UX Designer", "Product Designer", "Prototype Designer", "Freelance UI/UX Designer"]'::jsonb,
    '[{"question":"What does the course cover?","answer":"The deck includes apps, websites, games, prototyping, motion, and AI-assisted design."},{"question":"What are the fees?","answer":"The deck lists ₹1,40,000 regular and ₹1,00,000 hybrid; confirm current fees with admissions."}]'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    short_description = EXCLUDED.short_description,
    full_description = EXCLUDED.full_description,
    eligibility = EXCLUDED.eligibility,
    duration = EXCLUDED.duration,
    fees = EXCLUDED.fees,
    learning_mode = EXCLUDED.learning_mode,
    career_opportunities = EXCLUDED.career_opportunities,
    frequently_asked_questions = EXCLUDED.frequently_asked_questions,
    is_active = EXCLUDED.is_active,
    updated_at = now();
