export type VocabBattleQuestionOption = {
  label: string;
  text: string;
};

export type VocabBattleQuestionPayload = {
  id: string;
  questionText: string;
  options: VocabBattleQuestionOption[];
  position: number;
};

export type VocabBattleRoomQuestion = VocabBattleQuestionPayload & {
  correctOption: string;
  studySetItemId: string;
};
