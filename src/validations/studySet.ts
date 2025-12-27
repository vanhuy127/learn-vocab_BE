import { ACCESS_LEVEL_ARRAY } from '@/constants';
import { z } from 'zod';

export const vocabTermSchema = z.object({
  id: z.string().trim().min(1, 'Id is required'),
  word: z.string().trim().min(1, 'Word is required'),
  meaning: z.string().trim().min(1, 'Meaning is required'),
  note: z.string().trim().optional().or(z.literal('')),
  position: z.number().int('position is number'),
});

export const createStudySetSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  description: z.string().trim().max(255).optional().or(z.literal('')),
  accessLevel: z.enum(ACCESS_LEVEL_ARRAY, {
    errorMap: () => ({ message: 'Invalid access level' }),
  }),
  languageId: z.string().min(1, 'Language is required'),
  folderId: z.string().optional(),
  items: z.array(vocabTermSchema).min(2),
});
