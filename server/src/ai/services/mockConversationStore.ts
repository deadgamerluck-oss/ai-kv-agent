import { StudentContext } from '../prompts/counsellorPrompt';

export interface MockConversation {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  studentContext: StudentContext;
}

const conversations = new Map<string, MockConversation>();
const mockConversationIds = new Set<string>();

export const markMockConversation = (id: string): void => {
  mockConversationIds.add(id);
};

export const isMockConversation = (id: string): boolean => mockConversationIds.has(id);

export const getMockConversation = (id: string): MockConversation => {
  const conversation = conversations.get(id) || { history: [], studentContext: {} };
  conversations.set(id, conversation);
  return conversation;
};

export const appendMockMessage = (id: string, role: 'user' | 'assistant', content: string): void => {
  const conversation = getMockConversation(id);
  conversation.history.push({ role, content });
  if (conversation.history.length > 24) {
    conversation.history = conversation.history.slice(-24);
  }
};

export const updateMockStudentContext = (id: string, context: StudentContext): void => {
  getMockConversation(id).studentContext = context;
};
