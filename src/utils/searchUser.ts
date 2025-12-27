import db from '@/config/prisma.config';
import { calculationTotalPages } from './pagination';
import { AccessLevel, Role } from '@prisma/client';

export const getStudySets = async (skip: number, size: number, search: string) => {
  const whereClause = {
    ...(search && {
      name: { contains: search },
    }),
    isDeleted: false,
    accessLevel: AccessLevel.PUBLIC,
  };
  const [items, total] = await Promise.all([
    db.studySet.findMany({
      where: whereClause,
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        accessLevel: true,
        createdAt: true,
        updatedAt: true,
        language: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),

    db.studySet.count({
      where: whereClause,
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      size,
      totalPages: calculationTotalPages(total, size),
    },
  };
};

export const getFolders = async (skip: number, size: number, search: string) => {
  const whereClause = {
    ...(search && {
      name: { contains: search },
    }),
    isDeleted: false,
  };
  const [items, total] = await Promise.all([
    db.folder.findMany({
      where: whereClause,
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            userName: true,
          },
        },
        _count: {
          select: {
            studySets: true,
          },
        },
      },
    }),

    db.folder.count({
      where: whereClause,
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      size,
      totalPages: calculationTotalPages(total, size),
    },
  };
};

export const getTests = async (skip: number, size: number, search: string) => {
  const whereClause = {
    ...(search && {
      title: { contains: search },
    }),
    isDeleted: false,
    accessLevel: AccessLevel.PUBLIC,
  };
  const [items, total] = await Promise.all([
    db.test.findMany({
      where: whereClause,
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            userName: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
    }),

    db.test.count({
      where: whereClause,
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      size,
      totalPages: calculationTotalPages(total, size),
    },
  };
};

export const getUsers = async (skip: number, size: number, search: string) => {
  const whereClause = {
    ...(search && {
      OR: [{ email: { contains: search } }, { userName: { contains: search } }],
    }),
    role: Role.USER,
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where: whereClause,
      skip,
      take: size,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userName: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            folders: true,
            studySets: true,
          },
        },
      },
    }),

    db.user.count({
      where: whereClause,
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      size,
      totalPages: calculationTotalPages(total, size),
    },
  };
};
