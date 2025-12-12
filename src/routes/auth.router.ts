import {
  login,
  refreshAccessToken,
  changePassword,
  resetPassword,
  getMe,
  sendEmailForgotPassword,
  checkTokenAvailable,
} from '@/controllers/auth.controller';
import { authenticate } from '@/middlewares/authenticate';
import express from 'express';

const authRouter = express.Router();

authRouter.post('/auth/login', login);

// authRouter.get('/auth/logout', authenticate, logout);

authRouter.get('/auth/me', authenticate, getMe);

authRouter.get('/auth/refresh-token', refreshAccessToken);

authRouter.patch('/auth/change-password', authenticate, changePassword);

authRouter.patch('/auth/forgot-password', sendEmailForgotPassword);

authRouter.get('/auth/forgot-password/:token', checkTokenAvailable);

authRouter.patch('/auth/reset-password', resetPassword);

export default authRouter;
