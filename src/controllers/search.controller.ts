import { DEFAULT_PAGE, DEFAULT_SIZE, MESSAGE_CODES } from '@/constants';
import { calculationSkip, getFolders, getStudySets, getTests, getUsers, sendListResponse, sendResponse } from '@/utils';
import { Request, Response } from 'express';

export const userSearch = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
    const size = parseInt(req.query.size as string) || DEFAULT_SIZE;
    const skip = calculationSkip(page, size);
    const search = (req.query.search as string)?.trim().toLowerCase() || '';
    const type = (req.query.type as string)?.trim().toLowerCase() || '';

    let data;

    switch (type) {
      case 'study-set':
        data = await getStudySets(skip, size, search);
        break;

      case 'folder':
        data = await getFolders(skip, size, search);
        break;

      case 'test':
        data = await getTests(skip, size, search);
        break;

      case 'user':
        data = await getUsers(skip, size, search);
        break;

      default:
        sendResponse(res, {
          status: 400,
          success: false,
          message_code: MESSAGE_CODES.VALIDATION.INVALID_TYPE,
        });
        return;
    }

    sendListResponse(res, {
      status: 200,
      success: true,
      data: {
        type,
        data: data.items,
      },
      pagination: {
        total: data.pagination.total,
        page,
        size,
        totalPages: data.pagination.totalPages,
      },
      message_code: MESSAGE_CODES.SUCCESS.GET_SUCCESS,
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
