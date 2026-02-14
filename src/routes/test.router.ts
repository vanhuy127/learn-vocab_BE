import {
  createTest,
  deleteTest,
  editTest,
  getTestAttempt,
  getTestCurrent,
  getTestDetail,
  getTestHistory,
  getTestOverview,
  getTestResult,
  getTestStats,
  getUserTestDetail,
  startTest,
  submitTest,
} from '@/controllers/test.controller';
import { authenticate } from '@/middlewares/authenticate';
import express from 'express';

const testRouter = express.Router();

testRouter.get('/test/current-user', authenticate, getTestCurrent);

testRouter.get('/test/:id', authenticate, getTestDetail);

testRouter.get('/user/test/:id', authenticate, getUserTestDetail);

testRouter.get('/test/:id/overview', authenticate, getTestOverview);

testRouter.post('/test/:id/start', authenticate, startTest);

testRouter.get('/test/attempt/:attemptId', authenticate, getTestAttempt);

testRouter.post('/test/attempt/:attemptId/submit', authenticate, submitTest);

testRouter.get('/test/attempt/:attemptId/result', authenticate, getTestResult);

testRouter.get('/test/:id/history', authenticate, getTestHistory);

testRouter.get('/test/:id/stats', authenticate, getTestStats);

testRouter.post('/test', authenticate, createTest);

testRouter.put('/test/:id', authenticate, editTest);

testRouter.delete('/test/:id', authenticate, deleteTest);

export default testRouter;
