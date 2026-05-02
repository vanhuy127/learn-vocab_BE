import db from '@/config/prisma.config';
import { Server } from 'socket.io';
import { roomBySocketId, roomByUserId, rooms, waitingQueue } from './vocabBattle.state';
import { generateQuestions, goToNextQuestion, startTimer, toQuestionPayload } from './vocabBattle.utils';
import { Socket } from 'socket.io';

const cleanupRoomState = (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  if (room.timer) {
    clearTimeout(room.timer);
  }

  room.players.forEach((player) => {
    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
    }

    roomBySocketId.delete(player.socketId);
    roomByUserId.delete(player.userId);
    io.sockets.sockets.get(player.socketId)?.leave(roomId);
  });

  rooms.delete(roomId);
};

export const tryMatchPlayers = async (io: Server, socket: Socket) => {
  if (waitingQueue.length < 2) return;

  const p1 = waitingQueue.shift()!;
  const p2 = waitingQueue.shift()!;

  if (p1.userId === p2.userId) {
    waitingQueue.unshift(p2);
    return;
  }

  const match = await db.vocabularyBattleMatch.create({
    data: {
      players: {
        create: [{ userId: p1.userId }, { userId: p2.userId }],
      },
    },
  });

  rooms.set(match.id, {
    matchId: match.id,
    players: [
      { userId: p1.userId, socketId: p1.socketId },
      { userId: p2.userId, socketId: p2.socketId },
    ],
    currentQuestionIndex: 0,
    scores: {
      [p1.userId]: {
        name: p1.userName,
        score: 0,
      },
      [p2.userId]: {
        name: p2.userName,
        score: 0,
      },
    },
    answered: new Set(),
    questions: [],
    timeLimit: 30,
    status: 'WAITING',
  });

  //mapping socketId → roomId để dễ dàng tìm phòng khi có sự kiện từ client
  roomBySocketId.set(p1.socketId, match.id);
  roomBySocketId.set(p2.socketId, match.id);
  roomByUserId.set(p1.userId, match.id);
  roomByUserId.set(p2.userId, match.id);

  // cho 2 player vào cùng 1 phòng
  io.sockets.sockets.get(p1.socketId)?.join(match.id);
  io.sockets.sockets.get(p2.socketId)?.join(match.id);

  // thông báo đã tìm được trận đấu
  io.to(p1.socketId).emit('battle:match:found', { matchId: match.id });
  io.to(p2.socketId).emit('battle:match:found', { matchId: match.id });

  try {
    await startMatch(io, match.id);
  } catch (error) {
    console.error('startMatch error:', error);
    await cancelMatch(io, match.id);
  }
};

export const startMatch = async (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room with roomId ${roomId} not found`);
    return;
  }

  const questions = await generateQuestions(room.matchId);

  await db.vocabularyBattleMatch.update({
    where: { id: room.matchId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });

  room.status = 'IN_PROGRESS';

  io.to(roomId).emit('battle:match:started', {
    roomId,
    totalQuestions: questions.length,
  });

  io.to(roomId).emit('battle:start');

  io.to(roomId).emit('battle:score:update', {
    scores: room.scores,
  });

  await sendQuestion(io, roomId);
};

export const sendQuestion = async (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room with roomId ${roomId} not found`);
    return;
  }

  const question = room.questions[room.currentQuestionIndex];
  if (!question) {
    console.error(`No question found for roomId ${roomId} at index ${room.currentQuestionIndex}`);
    return;
  }

  io.to(roomId).emit('battle:question', {
    question: toQuestionPayload(question),
    timeLimit: room.timeLimit,
  });

  startTimer(io, roomId);
};

export const finishMatch = async (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room with roomId ${roomId} not found`);
    return;
  }

  const sortedScores = Object.entries(room.scores).sort((a, b) => b[1].score - a[1].score);
  const hasTie = sortedScores.length > 1 && sortedScores[0][1] === sortedScores[1][1];
  const winnerId = hasTie ? null : (sortedScores[0]?.[0] ?? null);
  const now = new Date();

  await db.$transaction([
    db.vocabularyBattleMatch.update({
      where: { id: room.matchId },
      data: {
        status: 'FINISHED',
        winnerId,
        endedAt: now,
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
          score: room.scores[player.userId].score ?? 0,
          isWinner: winnerId === player.userId,
        },
      }),
    ),
  ]);

  room.status = 'FINISHED';

  io.to(roomId).emit('battle:match:finished', {
    leaderboard: room.scores,
    winnerId,
  });

  cleanupRoomState(io, roomId);
};

export const cancelMatch = async (io: Server, roomId: string, userId?: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const now = new Date();

  await db.$transaction([
    db.vocabularyBattleMatch.update({
      where: { id: room.matchId },
      data: {
        status: 'CANCELLED',
        endedAt: now,
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
          score: room.scores[player.userId].score ?? 0,
          isWinner: false,
          leftAt: player.userId === userId ? now : null,
        },
      }),
    ),
  ]);

  room.status = 'CANCELLED';

  io.to(roomId).emit('battle:match:finished', {
    leaderboard: room.scores,
    cancelled: true,
    reason: userId ? 'PLAYER_LEFT' : 'MATCH_SETUP_FAILED',
  });

  cleanupRoomState(io, roomId);
};

export const handleAnswer = async (
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  payload: { answer?: string },
) => {
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room with roomId ${roomId} not found`);
    return;
  }

  const question = room.questions[room.currentQuestionIndex];

  if (!question) {
    socket.emit('battle:error', { message: 'QUESTION_NOT_FOUND' });
    return;
  }

  const isPlayerInRoom = room.players.some((player) => player.userId === userId);
  if (!isPlayerInRoom) {
    socket.emit('battle:error', { message: 'PLAYER_NOT_IN_MATCH' });
    return;
  }

  if (!payload?.answer || !['A', 'B', 'C', 'D'].includes(payload.answer)) {
    socket.emit('battle:error', { message: 'INVALID_ANSWER' });
    return;
  }

  if (room.answered.has(userId)) {
    socket.emit('battle:error', { message: 'You have already answered this question.' });
    return;
  }

  const isCorrect = payload.answer === question.correctOption;
  const scoreDelta = isCorrect ? 1 : 0;

  room.scores[userId] = {
    ...room.scores[userId],
    score: (room.scores[userId].score ?? 0) + scoreDelta,
  };
  room.answered.add(userId);

  await db.$transaction([
    db.vocabularyBattleAnswer.create({
      data: {
        matchId: room.matchId,
        questionId: question.id,
        userId,
        selectedOption: payload.answer,
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
        score: room.scores[userId].score,
      },
    }),
  ]);

  io.to(roomId).emit('battle:score:update', {
    scores: room.scores,
  });

  if (room.answered.size === room.players.length) {
    await goToNextQuestion(io, roomId);
  }
};
