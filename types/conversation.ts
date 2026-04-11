// types/conversation.ts

export type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  path?: 'simple' | 'complex';
  createdAt: string; // ISO string
};

export type LocalThread = {
  id: string;
  title: string | null;
  lastActive: string; // ISO string
  messages: LocalMessage[]; // last 30 messages cached
};

export type ThreadIndexEntry = {
  id: string;
  title: string | null;
  lastActive: string;
};
