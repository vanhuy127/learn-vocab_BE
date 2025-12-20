import db from '@/config/prisma.config';
import { MESSAGE_CODES } from '@/constants';
import { sendResponse } from '@/utils';
import { Request, Response } from 'express';

export const getFolderCurrent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const search = (req.query.search as string)?.trim().toLowerCase() || '';

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const folder = await db.folder.findMany({
      where: {
        user: {
          id: userId,
        },
        ...(search && {
          name: { contains: search },
        }),
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
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
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: folder,
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
  }
};
