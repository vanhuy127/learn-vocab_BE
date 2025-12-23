import {
  createFolder,
  deleteFolder,
  editFolder,
  getFolderById,
  getFolderCurrent,
} from '@/controllers/folder.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const folderRouter = express.Router();

folderRouter.post('/folder', authenticate, authorize(Role.USER, Role.ADMIN), createFolder);

folderRouter.patch('/folder/:id', authenticate, authorize(Role.USER, Role.ADMIN), editFolder);

folderRouter.delete('/folder/:id', authenticate, authorize(Role.USER, Role.ADMIN), deleteFolder);

folderRouter.get('/folder/current-user', authenticate, authorize(Role.USER, Role.ADMIN), getFolderCurrent);

folderRouter.get('/folder/:id', authenticate, authorize(Role.USER, Role.ADMIN), getFolderById);

export default folderRouter;
