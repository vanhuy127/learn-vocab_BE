import { verifyAccessToken } from '@/utils';
import { Socket } from 'socket.io';
import { BattleUserPayload } from './types';

export const getSocketUser = (socket: Socket): BattleUserPayload | null => {
  const user = socket.data.user as BattleUserPayload | undefined;
  if (!user?.id) {
    return null;
  }

  return user;
};

export const authenticateSocket = (socket: Socket, next: (err?: Error) => void) => {
  const authToken =
    (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
    (typeof socket.handshake.headers.authorization === 'string'
      ? socket.handshake.headers.authorization.replace('Bearer ', '')
      : '');

  if (!authToken) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  const { decoded, error } = verifyAccessToken(authToken);
  if (error || !decoded?.id) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  socket.data.user = {
    id: decoded.id as string,
    email: decoded.email as string | undefined,
    userName: decoded.userName as string | undefined,
    role: decoded.role as string | undefined,
  } satisfies BattleUserPayload;

  next();
};
