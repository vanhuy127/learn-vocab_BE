import db from '@/config/prisma.config';
import { MESSAGE_CODES } from '@/constants';
import { StudySetItemWithProgress } from '@/type';
import { sendResponse } from '@/utils';
import { getNextReview } from '@/utils/handleTime';
import { createStudySetSchema } from '@/validations';
import { AccessLevel } from '@prisma/client';
import { addDays } from 'date-fns';
import { Request, Response } from 'express';

export const getStudySetCurrent = async (req: Request, res: Response) => {
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

    const studySet = await db.studySet.findMany({
      where: {
        userId,
        ...(search && {
          OR: [
            { name: { contains: search } },
            {
              language: {
                name: { contains: search },
              },
            },
          ],
        }),
        isDeleted: false,
      },
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
            items: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: studySet,
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

export const createStudySet = async (req: Request, res: Response) => {
  try {
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

    const parsed = createStudySetSchema.safeParse(req.body);

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

    const { title, description, accessLevel, languageId, folderId, items } = parsed.data;

    const languageExisted = await db.language.findUnique({
      where: {
        id: languageId,
      },
    });

    if (!languageExisted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.INVALID_LANGUAGE,
      });
      return;
    }

    let finalFolderId: string | null = null;

    if (folderId && folderId !== 'none') {
      const folder = await db.folder.findFirst({
        where: {
          id: folderId,
          userId,
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
      finalFolderId = folder.id;
    }

    const studySet = await db.studySet.create({
      data: {
        name: title,
        description: description || null,
        accessLevel: accessLevel as AccessLevel,
        userId,
        languageId: languageExisted.id,
        folderId: finalFolderId,
        items: {
          create: items.map((t) => ({
            word: t.word,
            meaning: t.meaning,
            note: t.note || null,
            position: t.position,
          })),
        },
      },
      include: {
        items: true,
        language: true,
      },
    });

    sendResponse(res, {
      status: 201,
      success: true,
      data: studySet,
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
export const getStudySetById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id;
    const trackingProgress = req.query.trackingProgress || 'false';

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
    const now = new Date();

    const studySet = await db.studySet.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        language: true,
        folder: true,
        items: {
          where: {
            isDeleted: false,
            ...(trackingProgress === 'true' && {
              OR: [
                // 1️⃣ Item CHƯA từng học (không có progress)
                {
                  progress: {
                    none: {
                      userId,
                    },
                  },
                },
                // 2️⃣ Item ĐẾN HẠN ôn tập
                {
                  progress: {
                    some: {
                      userId,
                      nextReview: {
                        lte: now,
                      },
                    },
                  },
                },
              ],
            }),
          },
          orderBy: {
            position: 'asc',
          },
          include: {
            progress: {
              where: {
                userId,
              },
            },
          },
        },
      },
    });

    if (!studySet) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (trackingProgress === 'true') {
      const grouped: {
        new: StudySetItemWithProgress[];
        learning: StudySetItemWithProgress[];
        master: StudySetItemWithProgress[];
      } = {
        new: [],
        learning: [],
        master: [],
      };

      for (const item of studySet.items) {
        const p = item.progress[0];
        if (!p || p.status === 'NEW') grouped.new.push(item);
        else if (p.status === 'LEARNING') grouped.learning.push(item);
        else grouped.master.push(item);
      }

      studySet.items = [...grouped.new, ...grouped.learning, ...grouped.master];
    }

    sendResponse(res, {
      status: 200,
      success: true,
      data: studySet,
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

export const editStudySet = async (req: Request, res: Response) => {
  try {
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

    const studySetExisted = await db.studySet.findUnique({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      include: {
        items: true,
      },
    });

    if (!studySetExisted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const parsed = createStudySetSchema.safeParse(req.body);

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

    const { title, description, accessLevel, languageId, folderId, items } = parsed.data;

    const languageExisted = await db.language.findUnique({
      where: {
        id: languageId,
      },
    });

    if (!languageExisted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.INVALID_LANGUAGE,
      });
      return;
    }

    let finalFolderId: string | null = null;

    if (folderId && folderId !== 'none') {
      const folder = await db.folder.findFirst({
        where: {
          id: folderId,
          userId,
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
      finalFolderId = folder.id;
    }

    //handle update data
    const existingItemsMap = new Map(studySetExisted.items.map((item) => [item.id, item]));

    const incomingIds = new Set(items.map((i) => i.id));

    const upsertOperations = items.map((item) => {
      if (existingItemsMap.has(item.id)) {
        // UPDATE
        return db.studySetItem.update({
          where: { id: item.id },
          data: {
            word: item.word,
            meaning: item.meaning,
            note: item.note,
            position: item.position,
          },
        });
      }

      // CREATE (item mới)
      return db.studySetItem.create({
        data: {
          studySetId: studySetExisted.id,
          word: item.word,
          meaning: item.meaning,
          note: item.note,
          position: item.position,
        },
      });
    });

    //items to be deleted
    const deleteOperations = studySetExisted.items
      .filter((item) => !incomingIds.has(item.id))
      .map((item) =>
        db.studySetItem.update({
          where: { id: item.id },
          data: { isDeleted: true },
        }),
      );

    await db.$transaction([
      db.studySet.update({
        where: { id: studySetExisted.id },
        data: {
          name: title,
          description: description || null,
          accessLevel: accessLevel as AccessLevel,
          languageId,
          folderId: finalFolderId || null,
        },
      }),
      ...upsertOperations,
      ...deleteOperations,
    ]);

    const updatedStudySet = await db.studySet.findUnique({
      where: {
        id: studySetExisted.id,
        isDeleted: false,
      },
      include: {
        language: true,
        folder: true,
        items: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: updatedStudySet,
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

export const deleteStudySet = async (req: Request, res: Response) => {
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

    await db.studySet.update({
      where: { id },
      data: { isDeleted: true },
    });

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

export const submitStudySetItem = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id;
    const { isCorrect } = req.body;

    if (!id) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    const itemExisted = await db.studySetItem.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        progress: {
          where: {
            userId,
          },
        },
      },
    });

    if (!itemExisted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (itemExisted.progress.length === 0) {
      // lần đầu học từ này
      await db.userProgress.create({
        data: {
          userId,
          itemId: itemExisted.id,
          status: isCorrect ? 'LEARNING' : 'NEW',
          correctCount: isCorrect ? 1 : 0,
          wrongCount: isCorrect ? 0 : 1,
          lastStudiedAt: new Date(),
          nextReview: isCorrect ? addDays(new Date(), 1) : addDays(new Date(), 1),
        },
      });
    } else {
      const progress = itemExisted.progress[0];
      if (isCorrect) {
        const newCorrectCount = progress.correctCount + 1;
        await db.userProgress.update({
          where: { id: progress.id },
          data: {
            status: newCorrectCount >= 4 ? 'MASTERED' : 'LEARNING',
            correctCount: newCorrectCount,
            lastStudiedAt: new Date(),
            nextReview: getNextReview(newCorrectCount),
          },
        });
      } else {
        await db.userProgress.update({
          where: { id: progress.id },
          data: {
            status: 'LEARNING',
            correctCount: 0,
            wrongCount: progress.wrongCount + 1,
            nextReview: addDays(new Date(), 1),
            lastStudiedAt: new Date(),
          },
        });
      }
    }

    sendResponse(res, {
      status: 200,
      success: true,
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
