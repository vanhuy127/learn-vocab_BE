import { addDays } from 'date-fns';

export const getNextReview = (correctCount: number) => {
  const days = [0, 1, 3, 7, 15, 30];
  return addDays(new Date(), days[Math.min(correctCount, 5)]);
};
