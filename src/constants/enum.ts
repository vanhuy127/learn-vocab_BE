import { AccessLevel, Role } from '@prisma/client';

export const ROLE_ARRAY = Object.values(Role) as [string, ...string[]];

export const ACCESS_LEVEL_ARRAY = Object.values(AccessLevel) as [string, ...string[]];
