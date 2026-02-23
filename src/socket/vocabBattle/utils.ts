import { Server } from 'socket.io';
import { BattleRoomState } from './types';
import { QUESTION_TIME_LIMIT_SECONDS } from './constants';

export const sanitizeSelectedOption = (value: string): string => value.trim().toUpperCase();

export const shuffleArray = <T>(items: T[]): T[] => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[randomIndex]] = [clone[randomIndex], clone[i]];
  }
  return clone;
};

export const toLeaderboard = (room: BattleRoomState) =>
  room.players.map((player) => ({
    userId: player.userId,
    userName: player.userName,
    score: room.scores[player.userId] ?? 0,
  }));

export const emitQuestion = (io: Server, room: BattleRoomState) => {
  const question = room.questions[room.currentQuestionIndex];
  if (!question) {
    return;
  }

  io.to(room.roomId).emit('battle:question', {
    roomId: room.roomId,
    question: {
      id: question.id,
      questionText: question.questionText,
      position: question.position,
      options: question.options,
    },
    durationSeconds: QUESTION_TIME_LIMIT_SECONDS,
    deadlineAt: Date.now() + QUESTION_TIME_LIMIT_SECONDS * 1000,
  });
};

export const clearRoomTimer = (room: BattleRoomState) => {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
};
