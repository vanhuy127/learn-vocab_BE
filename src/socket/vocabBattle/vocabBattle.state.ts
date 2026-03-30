import { VocabBattleRoomQuestion } from '@/type';

export const waitingQueue: {
  userId: string;
  socketId: string;
  userName: string;
}[] = [];

export const rooms = new Map<
  string,
  {
    matchId: string;
    players: {
      userId: string;
      socketId: string;
      disconnectTimeout?: NodeJS.Timeout;
    }[];
    currentQuestionIndex: number;
    scores: Record<string, { name: string; score: number }>;
    answered: Set<string>;
    questions: VocabBattleRoomQuestion[];
    timer?: NodeJS.Timeout;
    timerStartedAt?: number;
    timeLimit: number;
    status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  }
>();

export const roomBySocketId = new Map<string, string>();
export const roomByUserId = new Map<string, string>();
