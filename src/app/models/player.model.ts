import { MatchSettings } from './match-settings.model';

/**
 * Player record stored in the 'players' table.
 * Each player has a 'team' field for quick reference, but the official
 * team roster is maintained in the separate 'teams' table.
 */
export interface Player {
  playerNumber: number;
  name: string;
  nickname: string;
  ageGroup: string;
  team: string;  // Team name for quick reference (may be empty)
}

/**
 * Team interface used in the application.
 * NOTE: The 'teams' database table stores individual teamName+playerNumber pairs,
 * NOT complete Team records. This interface is used for in-memory aggregation.
 *
 * Database storage:
 *   Each record: { teamName: string, playerNumber: number }
 *   Key path: ['teamName', 'playerNumber']
 *
 * Application usage:
 *   Teams are reconstructed by querying all records with matching teamName
 *   and aggregating playerNumbers into an array.
 */
export interface Team {
  teamName: string;
  playerNumbers: number[];  // Aggregated from multiple database records
}

export interface QuestionDetail {
  questionID: number;
  qdescription: string;
  qAnswer: string;
  qChapter: number;
  qBegVerse: number;
  qEndVerse: number;
  qDescType: string;
  book: string;
  version: string;
}

export interface QuestionSelect {
  selectionID: number;
  selectType: string;
  selChapter: number;
  selVerse: number;
  primUseCnt: number;
  bonUseCnt: number;
}

export interface QuizSet {
  setID: string;
  questNum: number;
  bonusNum: number;
}

export interface Verse {
  chapter: number;
  verse: number;
  text: string;
}

export interface QuestionType {
  typeID: string;
  class: string;
  leadIn: string;
}

export interface Parms {
  book: string;
  quizOutNum: number;
  errOutNum: number;
  foulOutNum: number;
  timeouts: number;
  matchLength: number;
  quizOutPoints: number;
  errOutPoints: number;
  foulOutPoints: number;
  penaltyNum: number;
  corrPoints: number;
  bonusPoints: number;
  tieBreaker: number;
}

export interface MatchSummary {
  quizID: string;
  matchID: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
}

export interface MatchDetail {
  quizID: string;
  matchID: string;
  seqNum: number;
  questNum: number;
  questType: string;
  questID: number;
  tm1Player1: number;
  tm1Player2: number;
  tm1Player3: number;
  tm1Player4: number;
  tm2Player1: number;
  tm2Player2: number;
  tm2Player3: number;
  tm2Player4: number;
  actionPlayer: number;
  action: string;
  points: number;
  canceled: boolean;
}

export interface MatchStats {
  playerNumber: number;
  quizID: string;
  matchID: string;
  activeQuestions: number;
  correct: number;
  errors: number;
  fouls: number;
  bonusCorrect: number;
  bonusErrors: number;
}

export interface UserFile {
  book: string;
  quizDBname: string;
  quizIDPre: string;
  quizIDNum: string;
  backupDrive: string;
  bookVersion?: string;
  datasetId?: string;
}

export interface TeamRoster {
  playerNumber: number;
  activeQuestions: number;
  correct: number;
  errors: number;
  fouls: number;
  bonusCorrect: number;
  bonusErrors: number;
  quizOut: boolean;
  errorOut: boolean;
  bonusOnly: boolean;
  name?: string;
  nickname?: string;
}

export interface TeamChair {
  playerNumber: number;
  rosterPosition: number;
  name: string;
  quizOut?: boolean;
  errorOut?: boolean;
  bonusOnly?: boolean;
  lastAnswerCorrect?: boolean | null;
}

export interface MatchState {
  quizID: string;
  matchID: string;
  team1Team: string;
  team2Team: string;
  team1Score: number;
  team2Score: number;
  team1Fouls: number;
  team1Errors: number;
  team1TOs: number;
  team1Appeals: number;
  team2Fouls: number;
  team2Errors: number;
  team2TOs: number;
  team2Appeals: number;
  questionNum: number;
  tieBreakNum: number;
  team1Chairs: TeamChair[];
  team2Chairs: TeamChair[];
  team1Roster: TeamRoster[];
  team2Roster: TeamRoster[];
  setID: string;
  currentQuestionID: number | null;
  bonusQuestion: boolean;
  finishQuest: boolean;
  questionIds?: number[];
  totalQuestions?: number;
  questionQueue?: { questNum: number; bonusNum: number }[];
  questionHistory?: number[];
  questionBank?: QuestionDetail[];
  questionLookupEntries?: [number, QuestionDetail][];
  verseLookupEntries?: [string, string][];
  questionTypeEntries?: [string, { leadIn: string; class?: string }][];
  matchSettings: MatchSettings;
  pendingBonusTeam?: 1 | 2 | null;
  pendingBonusSeat?: number | null;
}

