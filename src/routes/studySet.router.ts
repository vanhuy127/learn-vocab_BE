import {
  createStudySet,
  deleteStudySet,
  editStudySet,
  getAdminStudySet,
  getAdminStudySetById,
  getStudySet,
  getStudySetById,
  getStudySetCurrent,
  getStudySetForLearnQuiz,
  restoreStudySet,
  statisticsStudySetById,
  submitManyStudySetItems,
  submitStudySetItem,
} from '@/controllers/studySet.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const studySetRouter = express.Router();

studySetRouter.get('/admin/study-sets', authenticate, authorize(Role.ADMIN), getAdminStudySet);

studySetRouter.get('/admin/study-sets/:id/statistics', authenticate, authorize(Role.ADMIN), statisticsStudySetById);

studySetRouter.get('/admin/study-sets/:id', authenticate, authorize(Role.ADMIN), getAdminStudySetById);

studySetRouter.patch('/admin/study-sets/:id/restore', authenticate, authorize(Role.ADMIN), restoreStudySet);

studySetRouter.get('/study-set', getStudySet);

studySetRouter.post('/study-set', authenticate, createStudySet);

studySetRouter.put('/study-set/:id', authenticate, editStudySet);

studySetRouter.delete('/study-set/:id', authenticate, deleteStudySet);

studySetRouter.get('/study-set/current-user', authenticate, getStudySetCurrent);

studySetRouter.get('/study-set/:id/quiz', authenticate, getStudySetForLearnQuiz);

studySetRouter.get('/study-set/:id', authenticate, getStudySetById);

studySetRouter.post('/study-item/:id/answer', authenticate, submitStudySetItem);

studySetRouter.post('/study-item/:id/many-answer', authenticate, submitManyStudySetItems);

export default studySetRouter;
