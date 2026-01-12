import { StudySetItem, UserProgress } from '@prisma/client';

export type StudySetItemWithProgress = StudySetItem & {
  progress: UserProgress[];
};
