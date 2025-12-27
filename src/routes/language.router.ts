import { getLanguages } from '@/controllers/language.controller';
import express from 'express';

const languageRouter = express.Router();

languageRouter.get('/language', getLanguages);

export default languageRouter;
