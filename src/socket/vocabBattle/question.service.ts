import db from '@/config/prisma.config';
import { RuntimeBattleQuestion } from './types';
import { shuffleArray } from './utils';

export const buildBattleQuestions = async (
  count: number,
): Promise<Omit<RuntimeBattleQuestion, 'id'>[] | null> => {
  const items = await db.studySetItem.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      word: true,
      meaning: true,
    },
    take: Math.max(count * 4, 40),
  });

  if (items.length < 4) {
    return null;
  }

  const chosen = shuffleArray(items).slice(0, Math.min(count, items.length));
  const labelOrder = ['A', 'B', 'C', 'D'];
  const questions: Omit<RuntimeBattleQuestion, 'id'>[] = [];

  for (let index = 0; index < chosen.length; index += 1) {
    const currentItem = chosen[index];
    const wrongMeanings = shuffleArray(items.filter((item) => item.id !== currentItem.id))
      .slice(0, 3)
      .map((item) => item.meaning);

    if (wrongMeanings.length < 3) {
      continue;
    }

    const optionValues = shuffleArray([currentItem.meaning, ...wrongMeanings]);
    const options = optionValues.map((optionValue, optionIndex) => ({
      label: labelOrder[optionIndex],
      text: optionValue,
    }));

    const correctOption = options.find((option) => option.text === currentItem.meaning)?.label;
    if (!correctOption) {
      continue;
    }

    questions.push({
      studySetItemId: currentItem.id,
      questionText: `Which word means "${currentItem.meaning}"?`,
      position: index + 1,
      options,
      correctOption,
    });
  }

  return questions.length > 0 ? questions : null;
};

export const persistBattleQuestions = async (
  matchId: string,
  rawQuestions: Omit<RuntimeBattleQuestion, 'id'>[],
): Promise<RuntimeBattleQuestion[]> => {
  const createdQuestions = await Promise.all(
    rawQuestions.map(async (question, index) => {
      const optionMap = Object.fromEntries(question.options.map((option) => [option.label, option.text])) as Record<
        string,
        string
      >;

      const created = await db.vocabularyBattleQuestion.create({
        data: {
          matchId,
          studySetItemId: question.studySetItemId,
          questionText: question.questionText,
          optionA: optionMap.A,
          optionB: optionMap.B,
          optionC: optionMap.C,
          optionD: optionMap.D,
          correctOption: question.correctOption,
          position: index + 1,
        },
        select: {
          id: true,
        },
      });

      return {
        ...question,
        id: created.id,
      };
    }),
  );

  return createdQuestions;
};
