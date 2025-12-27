import {
  createFolder,
  deleteFolder,
  editFolder,
  getFolderById,
  getFolderCurrent,
} from '@/controllers/folder.controller';
import { authenticate } from '@/middlewares/authenticate';
import express from 'express';

const folderRouter = express.Router();

folderRouter.post('/folder', authenticate, createFolder);

folderRouter.put('/folder/:id', authenticate, editFolder);

folderRouter.delete('/folder/:id', authenticate, deleteFolder);

folderRouter.get('/folder/current-user', authenticate, getFolderCurrent);

folderRouter.get('/folder/:id', getFolderById);

export default folderRouter;
