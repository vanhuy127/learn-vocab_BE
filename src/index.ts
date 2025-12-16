import cookieParser from 'cookie-parser';
import express from 'express';
import authRouter from './routes/auth.router';
import userSearchRouter from './routes/search.router';

require('dotenv').config();

const cors = require('cors');
const app = express();

app.use(cookieParser());
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.use('/api/v1', authRouter);
app.use('/api/v1', userSearchRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
