import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import { socketMiddleware } from '@/middlewares/socket';
import { roomBySocketId, waitingQueue } from './vocabBattle.state';
import { handleAnswer, tryMatchPlayers } from './vocabBattle.service';
import { leaveMatch, rejoinMatch, scheduleMatchLeave } from './vocabBattle.utils';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
});

io.use(socketMiddleware);

io.on('connection', (socket) => {
  const user = socket.user;

  socket.emit('battle:ready');

  if (user) {
    rejoinMatch(io, socket, user.id);
  }

  //nhận sự kiện tham gia tìm trận đấu từ client
  socket.on('battle:queue:join', async () => {
    if (!user) {
      socket.emit('battle:error', { message: 'UNAUTHORIZED' });
      return;
    }

    //kiểm tra đang ở trong hàng đợi hay trong trận đấu nào chưa
    const isAlreadyQueued = waitingQueue.some((player) => player.userId === user.id || player.socketId === socket.id);

    if (isAlreadyQueued) {
      socket.emit('battle:error', { message: 'ALREADY_IN_QUEUE' });
      return;
    }

    if (roomBySocketId.has(socket.id)) {
      socket.emit('battle:error', { message: 'ALREADY_IN_MATCH' });
      return;
    }

    waitingQueue.push({
      userId: user.id,
      socketId: socket.id,
      userName: user?.name || 'Player',
    });

    console.log('waiting queue', waitingQueue);

    socket.emit('battle:queue:joined');

    await tryMatchPlayers(io, socket);
  });

  socket.on('battle:queue:leave', () => {
    if (!user) {
      socket.emit('battle:error', { message: 'UNAUTHORIZED' });
      return;
    }

    leaveMatch(io, socket.id, user.id)
      .then(() => {
        socket.emit('battle:queue:left');
      })
      .catch((error) => {
        console.error('battle:queue:leave error:', error);
        socket.emit('battle:error', { message: 'LEAVE_MATCH_FAILED' });
      });
  });

  socket.on('battle:answer', async (payload) => {
    const roomId = roomBySocketId.get(socket.id);
    if (!roomId) {
      socket.emit('battle:error', { message: 'NOT_IN_MATCH' });
      return;
    }
    if (!user) {
      socket.emit('battle:error', { message: 'UNAUTHORIZED' });
      return;
    }

    await handleAnswer(io, socket, roomId, user.id, payload);
  });

  socket.on('disconnect', async () => {
    console.log('socket disconnected: ', socket.id);

    if (!user) {
      return;
    }

    scheduleMatchLeave(io, socket.id, user.id);
  });
});

export { io, app, server };
// Client → Server
// 'battle:queue:join'
// 'battle:queue:leave'
// 'battle:answer'

// Server → Client
// 'battle:ready'
// 'battle:queue:joined'
// 'battle:queue:left'

// 'battle:match:found'
// 'battle:start'

// 'battle:question'
// 'battle:answer:result'
// 'battle:score:update'

// 'battle:next-question'
// 'battle:match:finished'

// 'battle:error'
