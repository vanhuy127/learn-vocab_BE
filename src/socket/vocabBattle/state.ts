import { BattleRoomState, QueuePlayer } from './types';

export const waitingQueue: QueuePlayer[] = [];
export const userQueueIndex = new Map<string, string>();
export const roomBySocketId = new Map<string, string>();
export const rooms = new Map<string, BattleRoomState>();

export const removePlayerFromQueue = (userId: string) => {
  const socketId = userQueueIndex.get(userId);
  if (!socketId) {
    return;
  }

  const index = waitingQueue.findIndex((queuePlayer) => queuePlayer.userId === userId);
  if (index >= 0) {
    waitingQueue.splice(index, 1);
  }
  userQueueIndex.delete(userId);
};
