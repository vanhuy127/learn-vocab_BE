import { getFolderCurrent } from '@/controllers/folder.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const folderRouter = express.Router();

folderRouter.get('/folder/current-user', authenticate, authorize(Role.USER, Role.ADMIN), getFolderCurrent);

export default folderRouter;
