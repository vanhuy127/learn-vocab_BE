import { VocabBattleQuestionPayload, VocabBattleRoomQuestion } from '@/type';
import { roomBySocketId, roomByUserId, rooms, waitingQueue } from './vocabBattle.state';
import db from '@/config/prisma.config';
import { Server } from 'socket.io';
import { cancelMatch, finishMatch, sendQuestion } from './vocabBattle.service';
import { Socket } from 'socket.io';

const DISCONNECT_GRACE_PERIOD_MS = 10000;

const shuffleArray = <T>(items: T[]) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

export const generateQuestions = async (matchId: string) => {
  const room = rooms.get(matchId);
  if (!room) {
    throw new Error(`Room with matchId ${matchId} not found`);
  }

  const studySetItems = await db.studySetItem.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
      word: true,
      meaning: true,
    },
  });

  if (studySetItems.length < 4) {
    throw new Error('Not enough study set items to generate battle questions.');
  }

  const selectedItems = shuffleArray(studySetItems).slice(0, Math.min(10, studySetItems.length));

  const questionsToCreate = selectedItems.map((item, index) => {
    const distractors = shuffleArray(
      studySetItems.filter((candidate) => candidate.id !== item.id && candidate.meaning.trim() !== item.meaning.trim()),
    )
      .filter(
        (candidate, candidateIndex, items) =>
          items.findIndex((current) => current.meaning.trim() === candidate.meaning.trim()) === candidateIndex,
      )
      .slice(0, 3);

    if (distractors.length < 3) {
      return null;
    }

    const options = shuffleArray([item.meaning, ...distractors.map((distractor) => distractor.meaning)]).map(
      (text, optionIndex) => ({
        label: String.fromCharCode(65 + optionIndex),
        text,
      }),
    );

    const correctOption = options.find((option) => option.text === item.meaning)?.label;
    if (!correctOption || options.length !== 4) {
      return null;
    }

    return {
      matchId,
      studySetItemId: item.id,
      questionText: item.word,
      optionA: options[0].text,
      optionB: options[1].text,
      optionC: options[2].text,
      optionD: options[3].text,
      correctOption,
      position: index,
    };
  });

  const validQuestionsToCreate = questionsToCreate.filter(
    (
      question,
    ): question is {
      matchId: string;
      studySetItemId: string;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
      position: number;
    } => question !== null,
  );

  if (validQuestionsToCreate.length === 0) {
    throw new Error('Could not generate any valid battle questions.');
  }

  await db.vocabularyBattleQuestion.createMany({
    data: validQuestionsToCreate,
  });

  const persistedQuestions = await db.vocabularyBattleQuestion.findMany({
    where: { matchId },
    orderBy: {
      position: 'asc',
    },
  });

  const questions: VocabBattleRoomQuestion[] = persistedQuestions.map((question) => ({
    id: question.id,
    studySetItemId: question.studySetItemId,
    questionText: question.questionText,
    options: [
      { label: 'A', text: question.optionA },
      { label: 'B', text: question.optionB },
      { label: 'C', text: question.optionC },
      { label: 'D', text: question.optionD },
    ],
    correctOption: question.correctOption,
    position: question.position,
  }));

  room.questions = questions;
  room.currentQuestionIndex = 0;
  room.answered.clear();

  return questions;
};

export const toQuestionPayload = (question: VocabBattleRoomQuestion): VocabBattleQuestionPayload => ({
  id: question.id,
  questionText: question.questionText,
  options: question.options,
  position: question.position,
});

export const startTimer = (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  if (room.timer) {
    clearTimeout(room.timer);
  }

  room.timerStartedAt = Date.now();

  room.timer = setTimeout(() => {
    goToNextQuestion(io, roomId);
  }, room.timeLimit * 1000);
};

export const goToNextQuestion = async (io: Server, roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room with roomId ${roomId} not found`);
    return;
  }

  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }

  room.currentQuestionIndex++;
  room.answered.clear();

  if (room.currentQuestionIndex >= room.questions.length) {
    await finishMatch(io, roomId);
    return;
  }

  await sendQuestion(io, roomId);
};

export const removePlayerFromQueue = (userId: string, socketId?: string) => {
  const index = waitingQueue.findIndex(
    (player) => player.userId === userId || (socketId ? player.socketId === socketId : false),
  );

  if (index !== -1) {
    waitingQueue.splice(index, 1);
    return true;
  }

  return false;
};

export const leaveMatch = async (io: Server, socketId: string, userId: string) => {
  if (removePlayerFromQueue(userId, socketId)) {
    return;
  }

  const roomId = roomBySocketId.get(socketId);
  if (!roomId) {
    return;
  }

  await cancelMatch(io, roomId, userId);
};

const mapRoomStatusToRejoinStatus = (status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED') => {
  if (status === 'WAITING') {
    return 'matched';
  }

  if (status === 'IN_PROGRESS') {
    return 'playing';
  }

  return 'finished';
};

export const rejoinMatch = (io: Server, socket: Socket, userId: string) => {
  //Tìm room theo userId
  const roomId = roomByUserId.get(userId);
  if (!roomId) {
    return false;
  }

  // Chặn các room không còn hợp lệ (đã bị hủy hoặc đã kết thúc)
  const room = rooms.get(roomId);
  if (!room || room.status === 'CANCELLED' || room.status === 'FINISHED') {
    roomByUserId.delete(userId);
    return false;
  }

  //Xác nhận user thật sự thuộc room đó hay không
  const player = room.players.find((currentPlayer) => currentPlayer.userId === userId);
  if (!player) {
    roomByUserId.delete(userId);
    return false;
  }

  // Hủy timeout “coi như đã rời trận” nếu có, sau đó cập nhật socketId mới và cho vào lại phòng
  if (player.disconnectTimeout) {
    clearTimeout(player.disconnectTimeout);
    player.disconnectTimeout = undefined;
  }

  if (player.socketId !== socket.id) {
    roomBySocketId.delete(player.socketId);
  }

  //Cập nhật socket mới cho player
  player.socketId = socket.id;
  roomBySocketId.set(socket.id, roomId);
  roomByUserId.set(userId, roomId);
  socket.join(roomId);

  //Khôi phục trạng thái trận cho client
  const currentQuestion = room.questions[room.currentQuestionIndex];
  const elapsedMs = room.timerStartedAt ? Date.now() - room.timerStartedAt : 0;
  const remainingSeconds = currentQuestion ? Math.max(0, Math.ceil(room.timeLimit - elapsedMs / 1000)) : undefined;

  socket.emit('battle:match:rejoined', {
    leaderboard: room.scores,
    matchId: room.matchId,
    question: currentQuestion ? toQuestionPayload(currentQuestion) : undefined,
    roomId,
    status: mapRoomStatusToRejoinStatus(room.status),
    timeLimit: currentQuestion ? room.timeLimit : undefined,
    timer: remainingSeconds,
    totalQuestions: room.questions.length || undefined,
  });

  return true;
};

export const scheduleMatchLeave = (io: Server, socketId: string, userId: string) => {
  //kiểm tra socketId có liên kết với phòng nào không
  const roomId = roomBySocketId.get(socketId);
  if (!roomId) {
    removePlayerFromQueue(userId, socketId);
    return;
  }

  //kiểm tra phòng đó có tồn tại không
  const room = rooms.get(roomId);
  if (!room) {
    roomBySocketId.delete(socketId);
    roomByUserId.delete(userId);
    return;
  }

  //kiểm tra socketId đó có phải của player trong phòng không
  const player = room.players.find((currentPlayer) => currentPlayer.userId === userId);
  if (!player || player.socketId !== socketId) {
    return;
  }

  //Xóa map theo socket cũ nhưng giữ map theo user
  roomBySocketId.delete(socketId);
  roomByUserId.set(userId, roomId);

  if (player.disconnectTimeout) {
    clearTimeout(player.disconnectTimeout);
  }

  //Lên lịch xóa phòng nếu sau khoảng thời gian nhất định mà player không kết nối lại
  player.disconnectTimeout = setTimeout(() => {
    const latestRoom = rooms.get(roomId);
    const latestPlayer = latestRoom?.players.find((currentPlayer) => currentPlayer.userId === userId);

    if (!latestRoom || !latestPlayer || latestPlayer.socketId !== socketId) {
      return;
    }

    latestPlayer.disconnectTimeout = undefined;
    leaveMatch(io, socketId, userId).catch((error) => {
      console.error('scheduleMatchLeave error:', error);
    });
  }, DISCONNECT_GRACE_PERIOD_MS);
};
