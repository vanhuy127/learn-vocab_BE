import db from '@/config/prisma.config';
import { Request, Response } from 'express';
import { sendResponse, calculationSkip, calculationTotalPages, sendListResponse } from '@/utils';
import { DEFAULT_PAGE, DEFAULT_SIZE, MESSAGE_CODES } from '@/constants';

export const getAdminListUser = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const whereClause: any = {
      ...(search && {
        OR: [{ email: { contains: search } }, { userName: { contains: search } }],
      }),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where: whereClause,
        skip,
        take: size,
        select: {
          id: true,
          email: true,
          userName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          refreshTokens: {
            select: {
              id: true,
              token: true,
              userAgent: true,
              ipAddress: true,
              expiresAt: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      db.user.count({ where: whereClause }),
    ]);
    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: users,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminUserDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        userName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        resetPwToken: true,
        resetPwExpireAt: true,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: user,
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });

    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminRTByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);

    const whereClause: any = {
      userId,
    };

    const [refreshTokens, total] = await Promise.all([
      db.refreshToken.findMany({
        where: whereClause,
        skip,
        take: size,
        select: {
          id: true,
          token: true,
          userAgent: true,
          ipAddress: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      db.refreshToken.count({ where: whereClause }),
    ]);
    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: refreshTokens,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminStudySetsByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const whereClause: any = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { language: { name: { contains: search } } },
          { folder: { name: { contains: search } } },
          { user: { email: { contains: search } } },
        ],
      }),
      isDeleted: false,
    };

    const [studySets, total] = await Promise.all([
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
          user: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      db.studySet.count({ where: whereClause }),
    ]);
    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: studySets,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminFoldersByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const whereClause: any = {
      userId,
      ...(search && {
        OR: [{ name: { contains: search } }],
      }),
      isDeleted: false,
    };

    const [folders, total] = await Promise.all([
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
          _count: {
            select: {
              studySets: true,
            },
          },
        },
      }),
      db.folder.count({ where: whereClause }),
    ]);

    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: folders,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminTestsByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const whereClause: any = {
      userId,
      ...(search && {
        OR: [{ title: { contains: search } }],
      }),
    };

    const [tests, total] = await Promise.all([
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
          accessLevel: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true,
          isDeleted: true,
          _count: {
            select: {
              results: true,
            },
          },
        },
      }),
      db.test.count({ where: whereClause }),
    ]);

    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: tests,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminTestResultsByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const whereClause: any = {
      userId,
      ...(search && {
        OR: [{ test: { title: { contains: search } } }],
      }),
    };

    const [testResults, total] = await Promise.all([
      db.testResult.findMany({
        where: whereClause,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          score: true,
          correctAnswers: true,
          totalQuestions: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          test: {
            select: {
              id: true,
              title: true,
              duration: true,
            },
          },
        },
      }),
      db.testResult.count({ where: whereClause }),
    ]);

    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: testResults,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getAdminBattlesByUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);

    const whereClause: any = {
      userId,
    };

    const [battles, total] = await Promise.all([
      db.vocabularyBattlePlayer.findMany({
        where: whereClause,
        skip,
        take: size,
        orderBy: { match: { createdAt: 'desc' } },
        select: {
          id: true,
          score: true,
          isWinner: true,
          joinedAt: true,
          leftAt: true,
          match: {
            select: {
              id: true,
              status: true,
              endedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      db.vocabularyBattlePlayer.count({ where: whereClause }),
    ]);

    const totalPages = calculationTotalPages(total, size);

    sendListResponse(res, {
      status: 200,
      success: true,
      data: battles,
      pagination: {
        total,
        page,
        size,
        totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
    return;
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};
