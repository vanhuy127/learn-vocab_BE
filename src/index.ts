import cookieParser from 'cookie-parser';
import express from 'express';
import { Server } from 'socket.io';
import authRouter from './routes/auth.router';
import userSearchRouter from './routes/search.router';
import folderRouter from './routes/folder.router';
import studySetRouter from './routes/studySet.router';
import testRouter from './routes/test.router';
import languageRouter from './routes/language.router';
import { registerVocabularyBattleSocket } from './socket/vocabBattle';

require('dotenv').config();

const cors = require('cors');
const http = require('http');
const app = express();

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONT_END_URL,
    credentials: true,
  }),
);
app.use(express.json());
const sever = http.createServer(app);

const PORT = process.env.PORT || 8000;

app.use('/api/v1', authRouter);
app.use('/api/v1', userSearchRouter);
app.use('/api/v1', folderRouter);
app.use('/api/v1', studySetRouter);
app.use('/api/v1', testRouter);
app.use('/api/v1', languageRouter);

const io = new Server(sever, {
  cors: {
    origin: process.env.FRONT_END_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

registerVocabularyBattleSocket(io);

sever.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
