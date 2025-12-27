import {
  createStudySet,
  deleteStudySet,
  editStudySet,
  getStudySetById,
  getStudySetCurrent,
} from '@/controllers/studySet.controller';
import { authenticate } from '@/middlewares/authenticate';
import express from 'express';

const studySetRouter = express.Router();

studySetRouter.post('/study-set', authenticate, createStudySet);

studySetRouter.put('/study-set/:id', authenticate, editStudySet);

studySetRouter.delete('/study-set/:id', authenticate, deleteStudySet);

studySetRouter.get('/study-set/current-user', authenticate, getStudySetCurrent);

studySetRouter.get('/study-set/:id', authenticate, getStudySetById);

export default studySetRouter;
