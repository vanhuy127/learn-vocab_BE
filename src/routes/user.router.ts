import {
  getAdminBattlesByUser,
  getAdminFoldersByUser,
  getAdminListUser,
  getAdminRTByUser,
  getAdminStudySetsByUser,
  getAdminTestResultsByUser,
  getAdminTestsByUser,
  getAdminUserDetails,
} from '@/controllers/user.controller';
import { authenticate } from '@/middlewares/authenticate';
import { authorize } from '@/middlewares/authorize';
import { Role } from '@prisma/client';
import express from 'express';

const userRouter = express.Router();

userRouter.get('/admin/users/:userId/refresh-tokens', authenticate, authorize(Role.ADMIN), getAdminRTByUser);

userRouter.get('/admin/users/:userId/study-sets', authenticate, authorize(Role.ADMIN), getAdminStudySetsByUser);

userRouter.get('/admin/users/:userId/folders', authenticate, authorize(Role.ADMIN), getAdminFoldersByUser);

userRouter.get('/admin/users/:userId/tests', authenticate, authorize(Role.ADMIN), getAdminTestsByUser);

userRouter.get('/admin/users/:userId/test-results', authenticate, authorize(Role.ADMIN), getAdminTestResultsByUser);

userRouter.get('/admin/users/:userId/battles', authenticate, authorize(Role.ADMIN), getAdminBattlesByUser);

userRouter.get('/admin/users/:userId', authenticate, authorize(Role.ADMIN), getAdminUserDetails);

userRouter.get('/admin/users', authenticate, authorize(Role.ADMIN), getAdminListUser);

export default userRouter;
