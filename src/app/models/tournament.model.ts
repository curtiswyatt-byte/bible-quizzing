export type TournamentType = 'single-elimination' | 'double-elimination';
export type TournamentStatus = 'setup' | 'in-progress' | 'completed';
export type BracketType = 'winners' | 'losers' | 'finals';
export type SeedingMethod = 'manual' | 'random';

export interface Tournament {
  tournamentID: string;
  name: string;
  type: TournamentType;
  status: TournamentStatus;
  teamNames: string[];              // Ordered by seed
  datasetId: string;
  rounds: TournamentRound[];
  createdAt: string;
  updatedAt: string;
}

export interface TournamentRound {
  roundNumber: number;
  bracketType: BracketType;
  name: string;                     // "Quarterfinals", "Losers Round 2", etc.
  questionSetId: string;            // Question set for this round
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  matchID: string;
  position: number;
  quizNumber: number;                         // Sequential quiz number (Quiz 1, Quiz 2, etc.)
  team1Slot: TeamSlot;
  team2Slot: TeamSlot;
  result: MatchResult | null;
  winnerAdvancesTo: MatchAdvancement | null;
  loserAdvancesTo: MatchAdvancement | null;   // For double elimination
}

export interface TeamSlot {
  type: 'team' | 'winner-of' | 'loser-of' | 'bye';
  teamName?: string;
  sourceMatchId?: string;
}

export interface MatchResult {
  team1Score: number;
  team2Score: number;
  winnerTeamName: string;
  loserTeamName: string;
  playedLocally: boolean;
  completedAt: string;
}

export interface MatchAdvancement {
  bracketType: BracketType;
  roundNumber: number;
  matchPosition: number;
  slot: 'team1' | 'team2';
}

// Input for creating a tournament
export interface CreateTournamentInput {
  name: string;
  type: TournamentType;
  teamNames: string[];
  seedingMethod: SeedingMethod;
  questionSetsByRound: Map<number, string>;  // roundNumber -> questionSetId
  datasetId: string;
}

// For rendering bracket positions
export interface BracketPosition {
  round: TournamentRound;
  match: TournamentMatch;
  column: number;
  row: number;
}
