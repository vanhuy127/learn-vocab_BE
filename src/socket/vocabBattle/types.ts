import { VocabularyBattleMatchStatus } from '@prisma/client';

export interface BattleUserPayload {
  id: string;
  email?: string;
  userName?: string;
  role?: string;
}

export interface QueuePlayer {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: number;
}

export interface PublicBattleQuestion {
  id: string;
  studySetItemId: string;
  questionText: string;
  position: number;
  options: Array<{ label: string; text: string }>;
}

export interface RuntimeBattleQuestion extends PublicBattleQuestion {
  correctOption: string;
}

export interface RoomPlayer {
  userId: string;
  userName: string;
  socketId: string;
}

export interface BattleRoomState {
  roomId: string;
  matchId: string;
  players: RoomPlayer[];
  questions: RuntimeBattleQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answeredByCurrentQuestion: Set<string>;
  timer: NodeJS.Timeout | null;
  status: VocabularyBattleMatchStatus;
}

export type BattleAnswerPayload = {
  roomId: string;
  questionId: string;
  selectedOption: string;
};
