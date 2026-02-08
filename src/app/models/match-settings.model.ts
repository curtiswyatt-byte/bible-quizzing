export interface MatchSettings {
  timeoutsPerTeam: number;
  answerTimeSeconds: number;
  speakWaitSeconds: number;
  timeoutDurationSeconds: number;
  appealsPerTeam: number;
  appealDurationSeconds: number;
  quizOutCorrect: number;
  quizOutBonusPoints: number;
  errorOutMisses: number;
  errorOutPenaltyPoints: number;
  foulsToFoulOut: number;
  foulOutPenalty: number;
  bonusQuestionPoints: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  timeoutsPerTeam: 2,
  answerTimeSeconds: 30,
  speakWaitSeconds: 3,
  timeoutDurationSeconds: 60,
  appealsPerTeam: 2,
  appealDurationSeconds: 90,
  quizOutCorrect: 4,
  quizOutBonusPoints: 10,
  errorOutMisses: 3,
  errorOutPenaltyPoints: -10,
  foulsToFoulOut: 2,
  foulOutPenalty: -10,
  bonusQuestionPoints: 10
};



