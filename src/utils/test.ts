import db from '@/config/prisma.config';

export const normalizeAnswer = (value?: string | null) => (value ?? '').trim().toLowerCase();

export const toTrueFalseValue = (value?: string | null) => {
  const raw = normalizeAnswer(value);
  if (!raw) return null;
  if (raw.includes('false') || raw.includes('sai')) return 'false';
  if (raw.includes('true') || raw.includes('đúng') || raw.includes('dung')) return 'true';
  return null;
};

export const buildTestResultPayload = async (attemptId: string, userId?: string) => {
  const attempt = await db.testResult.findUnique({
    where: { id: attemptId },
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
      details: {
        include: {
          selectedOptions: {
            include: {
              option: true,
            },
          },
        },
      },
    },
  });

  if (!attempt || (userId && attempt.userId !== userId)) return null;

  const totalPoints = attempt.test.questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
  const timeSpentSeconds = Math.max(0, Math.floor((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 1000));

  const detailMap = new Map(attempt.details.map((d) => [d.questionId, d]));

  const questions = attempt.test.questions.map((q) => {
    const detail = detailMap.get(q.id);

    const correctOptions = q.options.filter((o) => o.isCorrect);
    const correctAnswer =
      q.questionType === 'MULTI_CHOICE'
        ? correctOptions.map((o) => o.text)
        : q.questionType === 'FILL_IN'
          ? q.fillAnswers.map((a) => a.answerText)
          : q.questionType === 'T_F'
            ? correctOptions[0]?.text
            : correctOptions[0]?.text;

    let userAnswer: string | string[] | undefined;
    if (detail) {
      if (q.questionType === 'MULTI_CHOICE') {
        const texts = detail.selectedOptions.map((s) => s.option.text);
        userAnswer = texts.length > 0 ? texts : undefined;
      } else if (q.questionType === 'CHOICE') {
        const text = detail.selectedOptions[0]?.option.text;
        userAnswer = text || undefined;
      } else if (q.questionType === 'T_F') {
        const value = toTrueFalseValue(detail.studentAnswer);
        if (value === 'true') userAnswer = 'Đúng';
        if (value === 'false') userAnswer = 'Sai';
      } else if (q.questionType === 'FILL_IN') {
        userAnswer = detail.studentAnswer ?? undefined;
      }
    }

    return {
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      isCorrect: detail?.isCorrect ?? false,
      userAnswer,
      correctAnswer,
    };
  });

  return {
    attemptId: attempt.id,
    testId: attempt.testId,
    score: attempt.score,
    totalPoints,
    correctCount: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    timeSpentSeconds,
    allowReview: true,
    questions,
  };
};
