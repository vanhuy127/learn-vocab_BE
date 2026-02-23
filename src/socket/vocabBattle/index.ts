import { VocabularyBattleMatchStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { authenticateSocket, getSocketUser } from './auth';
import { roomBySocketId, rooms, removePlayerFromQueue, userQueueIndex, waitingQueue } from './state';
import { BattleAnswerPayload } from './types';
import { finishMatch, goToNextQuestion, saveBattleAnswer, tryMatchPlayers } from './match.service';
import { sanitizeSelectedOption, toLeaderboard } from './utils';

export const registerVocabularyBattleSocket = (io: Server) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const connectedUser = getSocketUser(socket);
    if (!connectedUser) {
      socket.disconnect();
      return;
    }

    socket.emit('battle:ready', {
      userId: connectedUser.id,
    });

    socket.on('battle:queue:join', async () => {
      const user = getSocketUser(socket);
      if (!user) {
        socket.emit('battle:error', { message: 'UNAUTHORIZED' });
        return;
      }

      const existingRoom = roomBySocketId.get(socket.id);
      if (existingRoom) {
        socket.emit('battle:error', {
          message: 'You are already in an active match.',
        });
        return;
      }

      removePlayerFromQueue(user.id);

      waitingQueue.push({
        userId: user.id,
        userName: user.userName || user.email || 'Player',
        socketId: socket.id,
        joinedAt: Date.now(),
      });
      userQueueIndex.set(user.id, socket.id);

      socket.emit('battle:queue:joined', {
        queuedAt: new Date().toISOString(),
      });

      await tryMatchPlayers(io);
    });

    socket.on('battle:queue:leave', () => {
      const user = getSocketUser(socket);
      if (!user) {
        return;
      }

      removePlayerFromQueue(user.id);
      socket.emit('battle:queue:left', {
        leftAt: new Date().toISOString(),
      });
    });

    socket.on('battle:answer', async (payload: BattleAnswerPayload) => {
      const user = getSocketUser(socket);
      if (!user) {
        socket.emit('battle:error', { message: 'UNAUTHORIZED' });
        return;
      }

      const roomId = roomBySocketId.get(socket.id);
      if (!roomId || roomId !== payload.roomId) {
        socket.emit('battle:error', { message: 'Invalid room.' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room || room.status !== VocabularyBattleMatchStatus.IN_PROGRESS) {
        socket.emit('battle:error', { message: 'Match has ended.' });
        return;
      }

      const currentQuestion = room.questions[room.currentQuestionIndex];
      if (!currentQuestion || currentQuestion.id !== payload.questionId) {
        socket.emit('battle:error', { message: 'Invalid question.' });
        return;
      }

      if (room.answeredByCurrentQuestion.has(user.id)) {
        socket.emit('battle:error', { message: 'You already answered this question.' });
        return;
      }

      const selectedOption = sanitizeSelectedOption(payload.selectedOption);
      if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
        socket.emit('battle:error', { message: 'Invalid option.' });
        return;
      }

      const isCorrect = selectedOption === currentQuestion.correctOption;
      const scoreDelta = isCorrect ? 1 : 0;

      room.scores[user.id] = (room.scores[user.id] ?? 0) + scoreDelta;
      room.answeredByCurrentQuestion.add(user.id);

      const saveError = await saveBattleAnswer(
        room,
        currentQuestion.id,
        user.id,
        selectedOption,
        isCorrect,
        scoreDelta,
      );
      if (saveError) {
        socket.emit('battle:error', { message: saveError });
        return;
      }

      socket.emit('battle:answer:result', {
        questionId: currentQuestion.id,
        selectedOption,
        isCorrect,
        scoreDelta,
        score: room.scores[user.id] ?? 0,
      });

      io.to(roomId).emit('battle:score:update', {
        roomId,
        leaderboard: toLeaderboard(room),
      });

      if (isCorrect) {
        await goToNextQuestion(io, room);
        return;
      }

      if (room.answeredByCurrentQuestion.size >= room.players.length) {
        await goToNextQuestion(io, room);
      }
    });

    socket.on('disconnect', async () => {
      const user = getSocketUser(socket);
      if (!user) {
        return;
      }

      removePlayerFromQueue(user.id);

      const roomId = roomBySocketId.get(socket.id);
      if (!roomId) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room || room.status !== VocabularyBattleMatchStatus.IN_PROGRESS) {
        return;
      }

      const opponent = room.players.find((player) => player.socketId !== socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit('battle:opponent:left', {
          roomId,
          message: 'Opponent left the match.',
        });
      }

      await finishMatch(io, room, VocabularyBattleMatchStatus.CANCELLED, opponent?.userId);
    });
  });
};
