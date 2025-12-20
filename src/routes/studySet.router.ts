import { getStudySetCurrent } from '@/controllers/studySet.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const studySetRouter = express.Router();

studySetRouter.get('/study-set/current-user', authenticate, authorize(Role.USER, Role.ADMIN), getStudySetCurrent);

export default studySetRouter;
