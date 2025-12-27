import { Request, Response } from 'express';
import { sendResponse } from '@/utils';
import { MESSAGE_CODES } from '@/constants';
import db from '@/config/prisma.config';

export const getLanguages = async (req: Request, res: Response) => {
  try {
    const languages = await db.language.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!languages) {
      sendResponse(res, {
        status: 404,
        success: true,
        data: [],
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }
    sendResponse(res, {
      status: 200,
      success: true,
      data: languages,
      message_code: MESSAGE_CODES.SUCCESS.GET_ALL_SUCCESS,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      success: false,
      message_code: MESSAGE_CODES.SERVER.INTERNAL_SERVER_ERROR,
    });
    return;
  }
};
