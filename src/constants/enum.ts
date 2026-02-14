import { AccessLevel, QuestionType, Role } from '@prisma/client';

export const ROLE_ARRAY = Object.values(Role) as [string, ...string[]];

export const ACCESS_LEVEL_ARRAY = Object.values(AccessLevel) as [string, ...string[]];

export const QUESTION_TYPE_ARRAY = Object.values(QuestionType) as [string, ...string[]];
