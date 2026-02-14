import db from '@/config/prisma.config';
import { MESSAGE_CODES } from '@/constants';
import { buildTestResultPayload, normalizeAnswer, sendResponse, toTrueFalseValue } from '@/utils';
import { createTestSchema, editTestSchema } from '@/validations';
import { AccessLevel, QuestionType } from '@prisma/client';
import { Request, Response } from 'express';

export const getTestCurrent = async (req: Request, res: Response) => {
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

    const test = await db.test.findMany({
      where: {
        user: {
          id: userId,
        },
        ...(search && {
          title: { contains: search },
        }),
        isDeleted: false,
      },
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
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: test,
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

export const createTest = async (req: Request, res: Response) => {
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

    const parsed = createTestSchema.safeParse(req.body);

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

    const { title, description, duration, accessLevel, questions } = parsed.data;

    const test = await db.test.create({
      data: {
        userId,
        title,
        description: description || null,
        duration: duration ?? null,
        accessLevel: accessLevel as AccessLevel,
        questions: {
          create: questions.map((q, index) => ({
            questionType: q.questionType as QuestionType,
            questionText: q.questionText,
            position: q.position ?? index,
            points: q.points ?? 0,
            options: q.options
              ? {
                  create: q.options.map((o, optionIndex) => ({
                    label: o.label,
                    text: o.text,
                    isCorrect: o.isCorrect ?? false,
                    position: o.position ?? optionIndex,
                  })),
                }
              : undefined,
            fillAnswers: q.fillAnswers
              ? {
                  create: q.fillAnswers.map((answerText) => ({
                    answerText,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
            fillAnswers: true,
          },
        },
      },
    });

    sendResponse(res, {
      status: 201,
      success: true,
      data: test,
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

export const getUserTestDetail = async (req: Request, res: Response) => {
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

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        questions: {
          orderBy: {
            position: 'asc',
          },
          include: {
            options: {
              orderBy: {
                position: 'asc',
              },
            },
            fillAnswers: true,
          },
        },
      },
    });

    if (!test) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (test.userId !== userId) {
      sendResponse(res, {
        status: 403,
        success: false,
        message_code: MESSAGE_CODES.AUTH.FORBIDDEN,
      });
      return;
    }

    sendResponse(res, {
      status: 200,
      success: true,
      data: test,
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

export const getTestDetail = async (req: Request, res: Response) => {
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

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        questions: {
          orderBy: {
            position: 'asc',
          },
          include: {
            options: {
              orderBy: {
                position: 'asc',
              },
            },
            fillAnswers: true,
          },
        },
      },
    });

    if (!test || test.isDeleted) {
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
      data: test,
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

export const editTest = async (req: Request, res: Response) => {
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

    const testExisted = await db.test.findFirst({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      include: {
        questions: true,
      },
    });

    if (!testExisted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const parsed = editTestSchema.safeParse(req.body);

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

    const { title, description, duration, accessLevel, questions } = parsed.data;

    const basicData = {
      title,
      description: description || null,
      duration: duration ?? null,
      accessLevel: accessLevel as AccessLevel,
    };

    if (testExisted.isLocked) {
      const updatedTest = await db.test.update({
        where: { id: testExisted.id },
        data: basicData,
      });

      sendResponse(res, {
        status: 200,
        success: true,
        data: updatedTest,
        message_code: MESSAGE_CODES.SUCCESS.UPDATED_SUCCESS,
      });
      return;
    }

    //validation id gửi lên có thuộc db hay không
    const existingQuestionIds = new Set(testExisted.questions.map((q) => q.id));
    const invalidQuestionIds = questions
      .map((q) => q.id)
      .filter((questionId): questionId is string => Boolean(questionId))
      .filter((questionId) => !existingQuestionIds.has(questionId));

    if (invalidQuestionIds.length > 0) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.VALIDATION_ERROR,
        messages: invalidQuestionIds.map((questionId) => ({
          field: 'questions.id',
          error_code: `Question ${questionId} does not belong to this test`,
        })),
      });
      return;
    }

    //mặc định luôn cập nhật các thông tin cơ bản
    const operations: any[] = [
      db.test.update({
        where: { id: testExisted.id },
        data: basicData,
      }),
    ];

    questions.forEach((q, index) => {
      const optionCreates = q.options?.map((o, optionIndex) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect ?? false,
        position: o.position ?? optionIndex,
      }));
      const fillAnswerCreates = q.fillAnswers?.map((answerText) => ({
        answerText,
      }));

      //nếu là câu hỏi chỉnh sửa thì xóa tất cả opt cũ ở tất cả loại -> thêm mới câu hỏi sau cập nhật vào
      if (q.id) {
        operations.push(
          db.option.deleteMany({
            where: {
              questionId: q.id,
            },
          }),
        );
        operations.push(
          db.fillAnswer.deleteMany({
            where: {
              questionId: q.id,
            },
          }),
        );
        operations.push(
          db.testQuestion.update({
            where: { id: q.id },
            data: {
              questionType: q.questionType as QuestionType,
              questionText: q.questionText,
              position: q.position,
              points: q.points,
              options: optionCreates
                ? {
                    create: optionCreates,
                  }
                : undefined,
              fillAnswers: fillAnswerCreates
                ? {
                    create: fillAnswerCreates,
                  }
                : undefined,
            },
          }),
        );
        return;
      }

      //nếu là câu hỏi được thêm mới thì thêm mới câu hỏi vào db
      operations.push(
        db.testQuestion.create({
          data: {
            testId: testExisted.id,
            questionType: q.questionType as QuestionType,
            questionText: q.questionText,
            position: q.position ?? index,
            points: q.points ?? 0,
            options: optionCreates
              ? {
                  create: optionCreates,
                }
              : undefined,
            fillAnswers: fillAnswerCreates
              ? {
                  create: fillAnswerCreates,
                }
              : undefined,
          },
        }),
      );
    });

    await db.$transaction(operations);

    await db.test.findFirst({
      where: {
        id: testExisted.id,
      },
      include: {
        questions: {
          orderBy: {
            position: 'asc',
          },
          include: {
            options: {
              orderBy: {
                position: 'asc',
              },
            },
            fillAnswers: true,
          },
        },
      },
    });

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

export const deleteTest = async (req: Request, res: Response) => {
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

    await db.test.update({
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

export const getTestOverview = async (req: Request, res: Response) => {
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

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    if (!test) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (test.accessLevel === AccessLevel.PRIVATE && test.userId !== userId) {
      sendResponse(res, {
        status: 403,
        success: false,
        message_code: MESSAGE_CODES.AUTH.FORBIDDEN,
      });
      return;
    }

    sendResponse(res, {
      status: 200,
      success: true,
      data: {
        id: test.id,
        title: test.title,
        description: test.description ?? undefined,
        duration: test.duration ?? undefined,
        totalQuestions: test._count.questions,
        ownerId: test.userId,
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

export const startTest = async (req: Request, res: Response) => {
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

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        questions: {
          orderBy: {
            position: 'asc',
          },
          include: {
            options: {
              orderBy: {
                position: 'asc',
              },
            },
          },
        },
      },
    });

    if (!test) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (test.accessLevel === 'PRIVATE' && test.userId !== userId) {
      sendResponse(res, {
        status: 403,
        success: false,
        message_code: MESSAGE_CODES.AUTH.FORBIDDEN,
      });
      return;
    }

    const now = new Date();
    const attempt = await db.testResult.create({
      data: {
        testId: test.id,
        userId: userId!,
        score: 0,
        correctAnswers: 0,
        totalQuestions: test.questions.length,
        startedAt: now,
        finishedAt: now,
      },
    });

    const durationSeconds = (test.duration ?? 0) * 60;

    sendResponse(res, {
      status: 201,
      success: true,
      data: {
        attemptId: attempt.id,
        testId: test.id,
        title: test.title,
        duration: test.duration ?? undefined,
        startedAt: attempt.startedAt,
        remainingSeconds: durationSeconds > 0 ? durationSeconds : undefined,
        questions: test.questions.map((q) => ({
          id: q.id,
          questionType: q.questionType,
          questionText: q.questionText,
          points: q.points ?? 0,
          options:
            q.questionType === 'CHOICE' || q.questionType === 'MULTI_CHOICE'
              ? q.options.map((o) => ({
                  id: o.id,
                  text: o.text,
                }))
              : undefined,
        })),
      },
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

export const getTestAttempt = async (req: Request, res: Response) => {
  try {
    const attemptId = req.params.attemptId;
    const userId = req.user?.id;

    if (!attemptId) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const attempt = await db.testResult.findFirst({
      where: {
        id: attemptId,
        userId,
      },
      include: {
        test: {
          include: {
            questions: {
              orderBy: {
                position: 'asc',
              },
              include: {
                options: {
                  orderBy: {
                    position: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt || attempt.test.isDeleted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    const durationSeconds = (attempt.test.duration ?? 0) * 60;
    const elapsedSeconds = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
    const remainingSeconds = durationSeconds > 0 ? Math.max(durationSeconds - elapsedSeconds, 0) : undefined;

    sendResponse(res, {
      status: 200,
      success: true,
      data: {
        attemptId: attempt.id,
        testId: attempt.testId,
        title: attempt.test.title,
        duration: attempt.test.duration ?? undefined,
        startedAt: attempt.startedAt,
        remainingSeconds,
        questions: attempt.test.questions.map((q) => ({
          id: q.id,
          questionType: q.questionType,
          questionText: q.questionText,
          points: q.points ?? 0,
          options:
            q.questionType === 'CHOICE' || q.questionType === 'MULTI_CHOICE'
              ? q.options.map((o) => ({
                  id: o.id,
                  text: o.text,
                }))
              : undefined,
        })),
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

export const submitTest = async (req: Request, res: Response) => {
  try {
    const attemptId = req.params.attemptId;
    const userId = req.user?.id;
    const { answers } = req.body as {
      answers: { questionId: string; answer: string | string[] }[];
    };

    if (!attemptId) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const attempt = await db.testResult.findFirst({
      where: {
        id: attemptId,
        userId,
      },
      include: {
        test: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: {
                options: true,
                fillAnswers: true,
              },
            },
          },
        },
        details: true,
      },
    });

    if (!attempt || attempt.test.isDeleted) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (!attempt.test.isLocked) {
      await db.test.update({
        where: {
          id: attempt.test.id,
        },
        data: {
          isLocked: true,
        },
      });
    }

    if (attempt.details.length > 0) {
      const existing = await buildTestResultPayload(attemptId, userId);
      sendResponse(res, {
        status: 200,
        success: true,
        data: existing,
        message_code: MESSAGE_CODES.SUCCESS.GET_SUCCESS,
      });
      return;
    }

    const answerMap = new Map(answers?.map((a) => [a.questionId, a.answer]) ?? []);

    let correctCount = 0;
    let totalScore = 0;

    const detailCreates = attempt.test.questions.map((q) => {
      const incoming = answerMap.get(q.id);

      let isCorrect = false;
      let studentAnswer: string | null = null;
      let selectedOptionIds: string[] = [];

      if (q.questionType === 'CHOICE') {
        const selectedId = typeof incoming === 'string' ? incoming : '';
        const correctOption = q.options.find((o) => o.isCorrect);
        const validSelected = q.options.some((o) => o.id === selectedId);
        isCorrect = Boolean(validSelected && correctOption && selectedId === correctOption.id);
        selectedOptionIds = validSelected ? [selectedId] : [];
      } else if (q.questionType === 'MULTI_CHOICE') {
        selectedOptionIds = Array.isArray(incoming) ? incoming : [];
        selectedOptionIds = selectedOptionIds.filter((id) => q.options.some((o) => o.id === id));
        const correctIds = q.options
          .filter((o) => o.isCorrect)
          .map((o) => o.id)
          .sort();
        const incomingIds = [...selectedOptionIds].sort();
        isCorrect =
          correctIds.length > 0 &&
          correctIds.length === incomingIds.length &&
          correctIds.every((id, index) => id === incomingIds[index]);
      } else if (q.questionType === 'T_F') {
        studentAnswer = typeof incoming === 'string' ? incoming : null;
        if (studentAnswer && studentAnswer.trim().length === 0) studentAnswer = null;
        const correctOption = q.options.find((o) => o.isCorrect);
        const correctValue = toTrueFalseValue(correctOption?.text ?? null);
        const incomingValue = toTrueFalseValue(studentAnswer);
        isCorrect = Boolean(correctValue && incomingValue && correctValue === incomingValue);
      } else if (q.questionType === 'FILL_IN') {
        studentAnswer = typeof incoming === 'string' ? incoming : null;
        if (studentAnswer && studentAnswer.trim().length === 0) studentAnswer = null;
        const incomingValue = normalizeAnswer(studentAnswer);
        isCorrect =
          incomingValue.length > 0 ? q.fillAnswers.some((a) => normalizeAnswer(a.answerText) === incomingValue) : false;
      }

      if (isCorrect) {
        correctCount += 1;
        totalScore += q.points ?? 0;
      }

      return db.testResultDetail.create({
        data: {
          resultId: attempt.id,
          questionId: q.id,
          studentAnswer,
          isCorrect,
          selectedOptions:
            selectedOptionIds.length > 0
              ? {
                  create: selectedOptionIds.map((optionId) => ({
                    optionId,
                  })),
                }
              : undefined,
        },
      });
    });

    const now = new Date();

    await db.$transaction([
      ...detailCreates,
      db.testResult.update({
        where: { id: attempt.id },
        data: {
          score: totalScore,
          correctAnswers: correctCount,
          totalQuestions: attempt.test.questions.length,
          finishedAt: now,
        },
      }),
    ]);

    const result = await buildTestResultPayload(attempt.id, userId);

    sendResponse(res, {
      status: 200,
      success: true,
      data: result,
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

export const getTestResult = async (req: Request, res: Response) => {
  try {
    const attemptId = req.params.attemptId;
    const userId = req.user?.id;

    if (!attemptId) {
      sendResponse(res, {
        status: 400,
        success: false,
        message_code: MESSAGE_CODES.VALIDATION.ID_REQUIRED,
      });
      return;
    }

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const result = await buildTestResultPayload(attemptId, userId);

    if (!result) {
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
      data: result,
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

export const getTestHistory = async (req: Request, res: Response) => {
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

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        userId: true,
      },
    });

    if (!test) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (test.userId !== userId) {
      sendResponse(res, {
        status: 403,
        success: false,
        message_code: MESSAGE_CODES.AUTH.FORBIDDEN,
      });
      return;
    }

    const results = await db.testResult.findMany({
      where: {
        testId: id,
        details: {
          some: {},
        },
      },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            email: true,
          },
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
    });

    const rows = results.map((result) => ({
      attemptId: result.id,
      studentId: result.user.id,
      studentName: result.user.userName,
      studentEmail: result.user.email,
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      timeSpentSeconds: Math.max(0, Math.floor((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000)),
    }));

    const uniqueStudentCount = new Set(rows.map((row) => row.studentId)).size;

    sendResponse(res, {
      status: 200,
      success: true,
      data: {
        testId: test.id,
        testTitle: test.title,
        totalAttempts: rows.length,
        totalStudents: uniqueStudentCount,
        rows,
      },
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

export const getTestStats = async (req: Request, res: Response) => {
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

    if (!userId) {
      sendResponse(res, {
        status: 401,
        success: false,
        message_code: MESSAGE_CODES.AUTH.UNAUTHORIZED,
      });
      return;
    }

    const test = await db.test.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        questions: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!test) {
      sendResponse(res, {
        status: 404,
        success: false,
        message_code: MESSAGE_CODES.SUCCESS.NOT_FOUND,
      });
      return;
    }

    if (test.userId !== userId) {
      sendResponse(res, {
        status: 403,
        success: false,
        message_code: MESSAGE_CODES.AUTH.FORBIDDEN,
      });
      return;
    }

    const results = await db.testResult.findMany({
      where: {
        testId: id,
        details: {
          some: {},
        },
      },
      include: {
        details: {
          include: {
            selectedOptions: true,
          },
        },
      },
    });

    const totalAttempts = results.length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const highestScore = results.reduce((max, r) => Math.max(max, r.score), 0);
    const totalTimeSeconds = results.reduce((sum, r) => {
      const elapsed = Math.max(0, Math.floor((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000));
      return sum + elapsed;
    }, 0);

    const questionStats = test.questions.map((q) => {
      let correct = 0;
      let wrong = 0;
      let skipped = 0;

      for (const result of results) {
        const detail = result.details.find((d) => d.questionId === q.id);
        if (!detail) {
          skipped += 1;
          continue;
        }
        const hasAnswer =
          (detail.studentAnswer && detail.studentAnswer.trim().length > 0) || detail.selectedOptions.length > 0;
        if (!hasAnswer) {
          skipped += 1;
          continue;
        }
        if (detail.isCorrect) correct += 1;
        else wrong += 1;
      }

      const denominator = totalAttempts > 0 ? totalAttempts : 1;

      return {
        id: q.id,
        questionText: q.questionText,
        correctRate: correct / denominator,
        wrongRate: wrong / denominator,
        skippedRate: skipped / denominator,
      };
    });

    sendResponse(res, {
      status: 200,
      success: true,
      data: {
        testId: test.id,
        totalAttempts,
        averageScore: totalAttempts > 0 ? totalScore / totalAttempts : 0,
        highestScore: totalAttempts > 0 ? highestScore : 0,
        averageTimeSeconds: totalAttempts > 0 ? Math.round(totalTimeSeconds / totalAttempts) : 0,
        questions: questionStats,
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
