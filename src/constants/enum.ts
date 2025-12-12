import { Role } from '@prisma/client';

export const ROLE_ARRAY = Object.values(Role) as [string, ...string[]];
