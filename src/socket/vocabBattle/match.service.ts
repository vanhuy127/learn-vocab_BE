import db from '@/config/prisma.config';
import { Prisma, VocabularyBattleMatchStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { DEFAULT_QUESTIONS_PER_MATCH, QUESTION_TIME_LIMIT_SECONDS } from './constants';
import { roomBySocketId, rooms, userQueueIndex, waitingQueue } from './state';
import { BattleRoomState, QueuePlayer } from './types';
import { buildBattleQuestions, persistBattleQuestions } from './question.service';
import { clearRoomTimer, emitQuestion, toLeaderboard } from './utils';

export const finishMatch = async (
  io: Server,
  room: BattleRoomState,
  status: VocabularyBattleMatchStatus,
  forceWinnerId?: string,
) => {
  clearRoomTimer(room);
  room.status = status;

  const scores = room.scores;
  const leaderboard = toLeaderboard(room);
  const playerA = room.players[0];
  const playerB = room.players[1];
  const scoreA = scores[playerA.userId] ?? 0;
  const scoreB = scores[playerB.userId] ?? 0;

  let winnerId: string | null = forceWinnerId || null;
  if (!winnerId && scoreA !== scoreB) {
    winnerId = scoreA > scoreB ? playerA.userId : playerB.userId;
  }

  await db.$transaction([
    db.vocabularyBattleMatch.update({
      where: { id: room.matchId },
      data: {
        status,
        endedAt: new Date(),
        winnerId: winnerId || null,
      },
    }),
    ...room.players.map((player) =>
      db.vocabularyBattlePlayer.update({
        where: {
          matchId_userId: {
            matchId: room.matchId,
            userId: player.userId,
          },
        },
        data: {
          score: scores[player.userId] ?? 0,
          isWinner: winnerId === player.userId,
          leftAt: status === VocabularyBattleMatchStatus.CANCELLED ? new Date() : undefined,
        },
      }),
    ),
  ]);

  io.to(room.roomId).emit('battle:finished', {
    roomId: room.roomId,
    matchId: room.matchId,
    status,
    winnerId,
    isDraw: !winnerId,
    leaderboard,
  });

  for (const player of room.players) {
    roomBySocketId.delete(player.socketId);
  }
  rooms.delete(room.roomId);
};

export const goToNextQuestion = async (io: Server, room: BattleRoomState) => {
  room.currentQuestionIndex += 1;
  room.answeredByCurrentQuestion = new Set<string>();

  if (room.currentQuestionIndex >= room.questions.length) {
    await finishMatch(io, room, VocabularyBattleMatchStatus.FINISHED);
    return;
  }

  clearRoomTimer(room);
  room.timer = setTimeout(async () => {
    await goToNextQuestion(io, room);
  }, QUESTION_TIME_LIMIT_SECONDS * 1000);
  emitQuestion(io, room);
};

export const startMatch = async (io: Server, firstPlayer: QueuePlayer, secondPlayer: QueuePlayer) => {
  const roomId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const questionsPerMatch = Number.isNaN(DEFAULT_QUESTIONS_PER_MATCH) ? 10 : DEFAULT_QUESTIONS_PER_MATCH;

  const rawQuestions = await buildBattleQuestions(Math.max(1, questionsPerMatch));
  if (!rawQuestions) {
    io.to(firstPlayer.socketId).emit('battle:error', {
      message: 'Not enough vocabulary data to create a match.',
    });
    io.to(secondPlayer.socketId).emit('battle:error', {
      message: 'Not enough vocabulary data to create a match.',
    });
    return;
  }

  const match = await db.vocabularyBattleMatch.create({
    data: {
      status: VocabularyBattleMatchStatus.IN_PROGRESS,
      startedAt: new Date(),
      players: {
        create: [{ userId: firstPlayer.userId }, { userId: secondPlayer.userId }],
      },
    },
    select: { id: true },
  });

  const persistedQuestions = await persistBattleQuestions(match.id, rawQuestions);

  const room: BattleRoomState = {
    roomId,
    matchId: match.id,
    players: [
      { userId: firstPlayer.userId, userName: firstPlayer.userName, socketId: firstPlayer.socketId },
      { userId: secondPlayer.userId, userName: secondPlayer.userName, socketId: secondPlayer.socketId },
    ],
    questions: persistedQuestions,
    currentQuestionIndex: 0,
    scores: {
      [firstPlayer.userId]: 0,
      [secondPlayer.userId]: 0,
    },
    answeredByCurrentQuestion: new Set<string>(),
    timer: null,
    status: VocabularyBattleMatchStatus.IN_PROGRESS,
  };

  rooms.set(roomId, room);
  roomBySocketId.set(firstPlayer.socketId, roomId);
  roomBySocketId.set(secondPlayer.socketId, roomId);

  const firstSocket = io.sockets.sockets.get(firstPlayer.socketId);
  const secondSocket = io.sockets.sockets.get(secondPlayer.socketId);
  if (!firstSocket || !secondSocket) {
    await finishMatch(io, room, VocabularyBattleMatchStatus.CANCELLED);
    return;
  }

  firstSocket.join(roomId);
  secondSocket.join(roomId);

  io.to(roomId).emit('battle:match:found', {
    roomId,
    matchId: match.id,
    players: room.players.map((player) => ({
      userId: player.userId,
      userName: player.userName,
    })),
    totalQuestions: room.questions.length,
    questionTimeLimitSeconds: QUESTION_TIME_LIMIT_SECONDS,
  });

  clearRoomTimer(room);
  room.timer = setTimeout(async () => {
    await goToNextQuestion(io, room);
  }, QUESTION_TIME_LIMIT_SECONDS * 1000);
  emitQuestion(io, room);
};

export const tryMatchPlayers = async (io: Server) => {
  while (waitingQueue.length >= 2) {
    const first = waitingQueue.shift();
    const second = waitingQueue.shift();
    if (!first || !second) {
      return;
    }

    userQueueIndex.delete(first.userId);
    userQueueIndex.delete(second.userId);
    await startMatch(io, first, second);
  }
};

export const saveBattleAnswer = async (
  room: BattleRoomState,
  questionId: string,
  userId: string,
  selectedOption: string,
  isCorrect: boolean,
  scoreDelta: number,
) => {
  try {
    await db.$transaction([
      db.vocabularyBattleAnswer.create({
        data: {
          matchId: room.matchId,
          questionId,
          userId,
          selectedOption,
          isCorrect,
          scoreDelta,
        },
      }),
      db.vocabularyBattlePlayer.update({
        where: {
          matchId_userId: {
            matchId: room.matchId,
            userId,
          },
        },
        data: {
          score: {
            increment: scoreDelta,
          },
        },
      }),
    ]);
    return null;
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError.code === 'P2002') {
      return 'You already answered this question.';
    }
    return 'Cannot save answer.';
  }
};
