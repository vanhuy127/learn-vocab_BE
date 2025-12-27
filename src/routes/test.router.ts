import { getTestCurrent } from '@/controllers/test.controller';
import { authenticate } from '@/middlewares/authenticate';
import express from 'express';

const testRouter = express.Router();

testRouter.get('/test/current-user', authenticate, getTestCurrent);

export default testRouter;
