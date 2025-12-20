import { getTestCurrent } from '@/controllers/test.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const testRouter = express.Router();

testRouter.get('/test/current-user', authenticate, authorize(Role.USER, Role.ADMIN), getTestCurrent);

export default testRouter;
