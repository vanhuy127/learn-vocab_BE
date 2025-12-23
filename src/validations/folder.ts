import { z } from 'zod';

export const folderSchema = z.object({
  name: z.string().min(3, 'Folder name must be at least 3 characters long'),
  description: z.string().optional(),
});
