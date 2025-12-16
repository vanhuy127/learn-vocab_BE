import { userSearch } from '@/controllers/search.controller';
import express from 'express';

const userSearchRouter = express.Router();

userSearchRouter.get('/search', userSearch);

export default userSearchRouter;
