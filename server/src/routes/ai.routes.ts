import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getSupabaseAdmin } from '../config/supabase';
import { generateCounsellorReply } from '../ai/services/chatEngineService';
import { extractStudentIntelligence } from '../ai/services/leadIntelligenceService';
import { appendMockMessage, getMockConversation, isMockConversation, markMockConversation, updateMockStudentContext } from '../ai/services/mockConversationStore';
import { StudentContext } from '../ai/prompts/counsellorPrompt';
import { 
  generateAnonymousSession, 
  hashSessionSecret, 
  verifySessionSecret 
} from '../middleware/session.auth';

const router = Router();

const redactContactDetails = (value: string): string => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email shared]')
  .replace(/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/gu, '[phone shared]');

const toStudentContext = (profile: Record<string, unknown> | null | undefined): StudentContext => {
  if (!profile) return {};
  return {
    fullName: typeof profile.full_name === 'string' ? profile.full_name : undefined,
    phone: typeof profile.phone === 'string' ? profile.phone : undefined,
    email: typeof profile.email === 'string' ? profile.email : undefined,
    location: typeof profile.location === 'string' ? profile.location : undefined,
    highestQualification: typeof profile.highest_qualification === 'string' ? profile.highest_qualification : undefined,
    currentEducation: typeof profile.current_education === 'string' ? profile.current_education : undefined,
    stream: typeof profile.stream === 'string' ? profile.stream : undefined,
    careerGoals: typeof profile.career_goals === 'string' ? profile.career_goals : undefined,
    budgetRange: typeof profile.budget_range === 'string' ? profile.budget_range : undefined,
    preferredLearningMode: typeof profile.preferred_learning_mode === 'string' ? profile.preferred_learning_mode : undefined,
    preferredLanguage: typeof profile.preferred_language === 'string' ? profile.preferred_language : undefined
  };
};

// ----------------------------------------------------------------------------
// POST /api/ai/conversations
// Initializes a secure student conversation and sets HTTP-only session cookie
// ----------------------------------------------------------------------------
router.post('/conversations', async (req: Request, res: Response) => {
  const { channel = 'chat', preferred_language = 'en', title = 'Admission Advisory Session' } = req.body;
  const { sessionId, rawSecret } = generateAnonymousSession();
  const secretHash = hashSessionSecret(rawSecret);

  const supabase = getSupabaseAdmin();
  let conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let databaseConversationCreated = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('counsellor_conversations')
        .insert({
          anonymous_session_id: sessionId,
          session_secret_hash: secretHash,
          conversation_title: title,
          channel,
          preferred_language,
          status: 'active'
        })
        .select('id')
        .single();

      if (!error && data?.id) {
        conversationId = data.id;
        databaseConversationCreated = true;
      } else if (error) {
        console.warn('[Supabase conversation insert warning]:', error.message);
      }
    } catch (e: unknown) {
      console.warn('[Supabase connection offline or unreachable]:', e instanceof Error ? e.message : e);
    }
  }

  if (!databaseConversationCreated) markMockConversation(conversationId);

  getMockConversation(conversationId);

  // Set HTTP-only secure cookie
  res.cookie(config.session.cookieName, `${sessionId}:${rawSecret}`, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  return res.status(201).json({
    success: true,
    conversationId,
    sessionId,
    channel,
    language: preferred_language
  });
});

// ----------------------------------------------------------------------------
// GET /api/ai/conversations/:id
// Retrieves authorized conversation history
// ----------------------------------------------------------------------------
router.get('/conversations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cookieVal = req.cookies?.[config.session.cookieName];
  const supabase = getSupabaseAdmin();

  if (!supabase || isMockConversation(id)) {
    return res.status(200).json({
      success: true,
      mode: 'mock',
      data: {
        id,
        messages: getMockConversation(id).history
      }
    });
  }

  // Authorize session
  if (!cookieVal || typeof cookieVal !== 'string') {
    return res.status(401).json({ success: false, message: 'Unauthorized session' });
  }

  const parts = cookieVal.split(':');
  const rawSecret = parts[1];

  const { data: conv, error: convErr } = await supabase
    .from('counsellor_conversations')
    .select('*, student:student_profiles(*)')
    .eq('id', id)
    .single();

  if (convErr || !conv || !conv.session_secret_hash) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  if (!verifySessionSecret(rawSecret, conv.session_secret_hash)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { data: messages } = await supabase
    .from('counsellor_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  return res.status(200).json({
    success: true,
    data: {
      ...conv,
      messages: messages || []
    }
  });
});

// ----------------------------------------------------------------------------
// POST /api/ai/chat
// Primary Real AI Chat processing endpoint
// ----------------------------------------------------------------------------
router.post('/chat', async (req: Request, res: Response) => {
  const { conversationId, message, language = 'auto' } = req.body;
  const responseChannel = req.body?.channel === 'voice' ? 'voice' : 'chat';
  const cookieVal = req.cookies?.[config.session.cookieName];
  const supabase = getSupabaseAdmin();

  if (!conversationId || !message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'conversationId and valid message are required' });
  }

  const memoryConversation = getMockConversation(conversationId);
  const useDatabase = Boolean(supabase && !isMockConversation(conversationId));
  let conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [...memoryConversation.history];
  let studentContext: StudentContext = { ...memoryConversation.studentContext };
  let conversationSummary = '';
  let conversationStudentId: string | null = null;

  // 1. Authorize session if Supabase is active
  if (useDatabase && supabase) {
    if (!cookieVal || typeof cookieVal !== 'string') {
      return res.status(401).json({ success: false, message: 'Unauthorized session cookie missing' });
    }
    const parts = cookieVal.split(':');
    const rawSecret = parts[1];

    try {
      const { data: conv, error: convErr } = await supabase
        .from('counsellor_conversations')
        .select('student_id, session_secret_hash, summary, student:student_profiles(*)')
        .eq('id', conversationId)
        .maybeSingle();

      if (convErr) {
        console.warn('[Supabase session check warning]:', convErr.message);
      } else if (conv && conv.session_secret_hash) {
        if (!verifySessionSecret(rawSecret, conv.session_secret_hash)) {
          return res.status(403).json({ success: false, message: 'Forbidden: Session ownership invalid' });
        }
        conversationStudentId = conv.student_id || null;
        conversationSummary = conv.summary || '';
        if (conv.student) {
          const profile = Array.isArray(conv.student) ? conv.student[0] : conv.student;
          studentContext = { ...studentContext, ...toStudentContext(profile as Record<string, unknown>) };
        }

        // Load recent message context
        const { data: dbMessages } = await supabase
          .from('counsellor_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (dbMessages) {
          conversationHistory = (dbMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>).reverse();
        }

      }
    } catch (dbErr) {
      console.warn('[Database conversation lookup error]:', dbErr);
    }
  }

  try {
    // Extract facts locally before generation so contact details never enter a model prompt.
    const intelligence = await extractStudentIntelligence(
      message,
      studentContext,
      conversationHistory,
      language
    );
    const updatedStudentContext: StudentContext = {
      ...studentContext,
      ...intelligence.extractedContext,
      courseInterests: intelligence.extractedContext.courseInterests || studentContext.courseInterests,
      contactDetailsProvided: Boolean(
        studentContext.contactDetailsProvided || intelligence.extractedContext.contactDetailsProvided ||
        intelligence.extractedContext.phone || intelligence.extractedContext.email
      ),
      callbackRequested: useDatabase && intelligence.callbackRequested,
      callbackConsentGiven: useDatabase && intelligence.callbackConsentGiven,
      callbackDeclined: intelligence.callbackDeclined,
      preferredLanguage: intelligence.detectedLanguage
    };
    updateMockStudentContext(conversationId, updatedStudentContext);

    const safeMessage = redactContactDetails(message);
    const safeHistory = conversationHistory.map((entry) => ({ ...entry, content: redactContactDetails(entry.content) }));
    const chatResult = await generateCounsellorReply({
      userMessage: safeMessage,
      conversationHistory: safeHistory,
      studentContext: updatedStudentContext,
      conversationSummary,
      preferredLanguage: intelligence.detectedLanguage,
      callbackDeliveryAvailable: useDatabase,
      responseChannel
    });

    const storedUserMessage = intelligence.callbackConsentGiven ? message : safeMessage;
    if (useDatabase && supabase) {
      await supabase.from('counsellor_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: storedUserMessage,
        channel: responseChannel,
        language: intelligence.detectedLanguage
      });
    }
    appendMockMessage(conversationId, 'user', safeMessage);
    appendMockMessage(conversationId, 'assistant', redactContactDetails(chatResult.reply));

    // Persist the profile and lead only after the student explicitly asks for or agrees to a callback.
    if (useDatabase && supabase) {
      try {
        await supabase.from('counsellor_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: chatResult.reply,
          channel: responseChannel,
          language: intelligence.detectedLanguage
        });

        await supabase
          .from('counsellor_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            interest_level: intelligence.interestLevel,
            admission_readiness: intelligence.admissionReadiness,
            preferred_language: intelligence.detectedLanguage,
            ...(intelligence.callbackRequested ? { status: 'callback_requested' } : {})
          })
          .eq('id', conversationId);

        const hasStudentContact = Boolean(updatedStudentContext.fullName || updatedStudentContext.phone || updatedStudentContext.email);
        let studentId = conversationStudentId;
        if (intelligence.callbackConsentGiven && intelligence.callbackRequested && hasStudentContact) {
          const profileData = {
            full_name: updatedStudentContext.fullName || null,
            phone: updatedStudentContext.phone || null,
            email: updatedStudentContext.email || null,
            location: updatedStudentContext.location || null,
            highest_qualification: updatedStudentContext.highestQualification || null,
            current_education: updatedStudentContext.currentEducation || null,
            stream: updatedStudentContext.stream || null,
            career_goals: updatedStudentContext.careerGoals || null,
            budget_range: updatedStudentContext.budgetRange || null,
            preferred_learning_mode: updatedStudentContext.preferredLearningMode || null,
            preferred_language: intelligence.detectedLanguage
          };
          if (studentId) {
            await supabase.from('student_profiles').update(profileData).eq('id', studentId);
          } else {
            const { data: profile } = await supabase.from('student_profiles').insert(profileData).select('id').single();
            studentId = profile?.id || null;
            if (studentId) {
              await supabase.from('counsellor_conversations').update({ student_id: studentId }).eq('id', conversationId);
            }
          }
        }

        if (intelligence.callbackConsentGiven && intelligence.callbackRequested && hasStudentContact) {
          const { data: existingLead } = await supabase
            .from('admission_leads')
            .select('id, student_id')
            .eq('conversation_id', conversationId)
            .maybeSingle();

          if (existingLead) {
            await supabase.from('admission_leads').update({
              student_id: studentId || existingLead.student_id,
              callback_requested: true,
              callback_consent_at: new Date().toISOString()
            }).eq('id', existingLead.id);
          } else {
            await supabase.from('admission_leads').insert({
              student_id: studentId,
              conversation_id: conversationId,
              lead_temperature: intelligence.leadTemperature === 'cold' ? 'warm' : intelligence.leadTemperature,
              lead_status: 'qualified',
              callback_requested: true,
              callback_consent_at: new Date().toISOString(),
              summary: `Callback requested through Khushi course counselling. Interest: ${(updatedStudentContext.courseInterests || []).join(', ') || 'Not specified'}.`
            });
          }
        }
      } catch (postDbErr) {
        console.warn('[Post-response database persistence warning]:', postDbErr);
      }
    }

    const safeExtractedContext = { ...intelligence.extractedContext };
    delete safeExtractedContext.phone;
    delete safeExtractedContext.email;

    return res.status(200).json({
      success: true,
      reply: chatResult.reply,
      conversationId,
      language: intelligence.detectedLanguage,
      studentContext: {
        ...safeExtractedContext,
        callbackRequested: updatedStudentContext.callbackRequested,
        callbackConsentGiven: updatedStudentContext.callbackConsentGiven,
        callbackDeclined: updatedStudentContext.callbackDeclined
      },
      suggestedQuestions: intelligence.suggestedQuestions,
      conversationStage: intelligence.conversationStage,
      isSimulated: chatResult.isSimulated,
      model: chatResult.model
    });
  } catch (error: unknown) {
    let errorMessage = 'AI Processing Failed';
    if (error && typeof error === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = error as any;
      if (anyErr.status === 429 || anyErr.code === 'insufficient_quota') {
        errorMessage = 'The Gemini API usage limit was reached. Check the configured Gemini API key and quota, then try again.';
      } else if (anyErr.message) {
        errorMessage = anyErr.message;
      }
    }
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

export default router;
