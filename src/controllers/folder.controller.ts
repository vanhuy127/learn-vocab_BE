import db from '@/config/prisma.config';
import { MESSAGE_CODES } from '@/constants';
import { sendResponse } from '@/utils';
import { folderSchema } from '@/validations';
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

export const createFolder = async (req: Request, res: Response) => {
  try {
    const parsed = folderSchema.safeParse(req.body);
    const userId = req.user?.id;

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

    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });
      return;
    }

    const { name, description } = parsed.data;

    const existingFolder = await db.folder.findFirst({ where: { name, userId } });

    if (existingFolder) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.NAME_ALREADY_EXISTS,
      });
      return;
    }

    const folder = await db.folder.create({
      data: {
        name,
        description,
        userId,
      },
    });

    sendResponse(res, {
      status: 201,
      success: true,
      data: folder,
      message_code: MESSAGE_CODES.SUCCESS.CREATED_SUCCESS,
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

export const getFolderById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id;

    if (!id) {
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
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const folder = await db.folder.findUnique({
      where: { id, userId, isDeleted: false },
    });

    if (!folder) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    sendResponse(res, {
      status: 200,
      success: true,
      data: folder,
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

export const editFolder = async (req: Request, res: Response) => {
  try {
    const parsed = folderSchema.safeParse(req.body);
    const userId = req.user?.id;

    const id = req.params.id;

    if (!id) {
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
    });

    if (!user) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (!parsed.success) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          error_code: err.message,
        })),
      });
      return;
    }

    const { name, description } = parsed.data;

    const existingFolder = await db.folder.findFirst({ where: { name, userId, id: { not: id } } });

    if (existingFolder) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.NAME_ALREADY_EXISTS,
      });
      return;
    }

    const folder = await db.folder.update({
      where: {
        id,
      },
      data: {
        name,
        description,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: folder,
      message_code: MESSAGE_CODES.SUCCESS.UPDATED_SUCCESS,
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

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    const folder = await db.folder.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!folder) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    await db.$transaction([
      // 1. Gỡ liên kết folder khỏi các study set con
      db.studySet.updateMany({
        where: {
          folderId: id,
          isDeleted: false,
        },
        data: {
          folderId: null,
        },
      }),

      // 2. Soft delete folder
      db.folder.update({
        where: { id },
        data: { isDeleted: true },
      }),
    ]);

    sendResponse(res, {
      status: 200,
      success: true,
      message_code: MESSAGE_CODES.SUCCESS.DELETED_SUCCESS,
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
