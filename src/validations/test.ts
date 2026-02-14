import { ACCESS_LEVEL_ARRAY, QUESTION_TYPE_ARRAY } from '@/constants';
import { z } from 'zod';

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required'),
  text: z.string().trim().min(1, 'Option text is required'),
  isCorrect: z.boolean().optional(),
  position: z.number().int('position is number').optional(),
});

const questionObjectSchema = z.object({
  questionType: z.enum(QUESTION_TYPE_ARRAY, {
    errorMap: () => ({ message: 'Invalid question type' }),
  }),
  questionText: z.string().trim().min(1, 'Question is required'),
  position: z.number().int('position is number').optional(),
  points: z.number().int('points is number').min(0).optional(),
  options: z.array(optionSchema).optional(),
  fillAnswers: z.array(z.string().trim().min(1, 'Answer is required')).optional(),
});

const questionRules = (value: z.infer<typeof questionObjectSchema>, ctx: z.RefinementCtx) => {
  const hasOptions = Array.isArray(value.options) && value.options.length > 0;
  const hasFillAnswers = Array.isArray(value.fillAnswers) && value.fillAnswers.length > 0;

  if (value.questionType === 'FILL_IN') {
    if (!hasFillAnswers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fillAnswers'],
        message: 'Fill answers are required',
      });
    }
    if (hasOptions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Options are not allowed for fill-in questions',
      });
    }
    return;
  }

  if (!hasOptions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Options are required',
    });
    return;
  }

  if (value.questionType === 'CHOICE' || value.questionType === 'T_F') {
    const correctCount = value.options?.filter((o) => o.isCorrect).length ?? 0;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Exactly one correct option is required',
      });
    }
  }

  if (value.questionType === 'MULTI_CHOICE') {
    const correctCount = value.options?.filter((o) => o.isCorrect).length ?? 0;
    if (correctCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'At least one correct option is required',
      });
    }
  }
};

const createQuestionSchema = questionObjectSchema.superRefine(questionRules);
const editQuestionSchema = questionObjectSchema
  .extend({
    id: z.string().uuid('Invalid question id').optional(),
  })
  .superRefine(questionRules);

export const createTestSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  description: z.string().trim().max(255).optional().or(z.literal('')),
  duration: z.number().int('duration is number').min(1).optional(),
  accessLevel: z.enum(ACCESS_LEVEL_ARRAY, {
    errorMap: () => ({ message: 'Invalid access level' }),
  }),
  questions: z.array(createQuestionSchema).min(1, 'At least one question is required'),
});

export const editTestSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  description: z.string().trim().max(255).optional().or(z.literal('')),
  duration: z.number().int('duration is number').min(1).optional(),
  accessLevel: z.enum(ACCESS_LEVEL_ARRAY, {
    errorMap: () => ({ message: 'Invalid access level' }),
  }),
  questions: z.array(editQuestionSchema).optional().default([]),
});
