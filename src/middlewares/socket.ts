import { MESSAGE_CODES } from '@/constants';
import { NextFunction } from 'express';
import { Socket } from 'socket.io';
import { verifyAccessToken } from '@/utils';
import db from '@/config/prisma.config';

declare module 'socket.io' {
  interface Socket {
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

export const socketMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      next(new Error(MESSAGE_CODES.AUTH.UNAUTHORIZED));
      return;
    }

    const { decoded } = verifyAccessToken(token);

    if (!decoded) {
      next(new Error(MESSAGE_CODES.AUTH.UNAUTHORIZED));
      return;
    }

    const user = await db.user.findUnique({
      where: {
        id: decoded.id,
      },
    });

    if (!user) {
      next(new Error(MESSAGE_CODES.SUCCESS.NOT_FOUND));
      return;
    }

    socket.user = {
      id: user.id,
      email: user.email,
      name: user.userName,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Socket middleware error: ', error);
    next(new Error(MESSAGE_CODES.AUTH.UNAUTHORIZED));
  }
};
