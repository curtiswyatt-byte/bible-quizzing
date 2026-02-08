import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import {
  Tournament,
  TournamentType,
  TournamentStatus,
  TournamentRound,
  TournamentMatch,
  TeamSlot,
  MatchResult,
  MatchAdvancement,
  BracketType,
  CreateTournamentInput
} from '../models/tournament.model';
import { MatchSummary } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  constructor(private dbService: DatabaseService) {}

  // Generate a unique tournament ID
  private generateTournamentID(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `T-${timestamp}-${random}`;
  }

  // Generate a unique match ID within a tournament
  private generateMatchID(roundNumber: number, position: number, bracketType: BracketType): string {
    const prefix = bracketType === 'winners' ? 'W' : bracketType === 'losers' ? 'L' : 'F';
    return `${prefix}R${roundNumber}M${position + 1}`;
  }

  // Get the next power of 2 >= n
  private nextPowerOf2(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  // Shuffle array (Fisher-Yates)
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Generate standard bracket seeding order
  // For 8 teams: [1,8], [4,5], [2,7], [3,6] - maximizes distance between top seeds
  // This ensures byes (high seed numbers) are spread against top seeds
  private generateSeedPairings(bracketSize: number): [number, number][] {
    // Standard bracket seeding algorithm
    // Recursively builds bracket positions to maximize distance between top seeds
    const getPositions = (numTeams: number): number[] => {
      if (numTeams === 2) {
        return [1, 2];
      }

      const halfSize = numTeams / 2;
      const topHalf = getPositions(halfSize);

      // For each position in top half, create its "mirror" pairing
      // Position i plays position (numTeams + 1 - i)
      const result: number[] = [];
      for (const pos of topHalf) {
        result.push(pos);
        result.push(numTeams + 1 - pos);
      }

      return result;
    };

    const positions = getPositions(bracketSize);

    // Convert to pairings
    const pairings: [number, number][] = [];
    for (let i = 0; i < positions.length; i += 2) {
      pairings.push([positions[i], positions[i + 1]]);
    }

    return pairings;
  }

  // Get round name based on matches remaining
  private getRoundName(matchesInRound: number, roundNumber: number, totalRounds: number, bracketType: BracketType): string {
    if (bracketType === 'finals') {
      return roundNumber === 1 ? 'Finals' : 'Grand Finals';
    }

    const prefix = bracketType === 'losers' ? 'Losers ' : '';

    if (matchesInRound === 1) return prefix + 'Finals';
    if (matchesInRound === 2) return prefix + 'Semifinals';
    if (matchesInRound === 4) return prefix + 'Quarterfinals';

    return prefix + `Round ${roundNumber}`;
  }

  // Create a tournament
  async createTournament(input: CreateTournamentInput): Promise<Tournament> {
    const tournamentID = this.generateTournamentID();
    const now = new Date().toISOString();

    // Apply seeding
    let seededTeams = input.teamNames;
    if (input.seedingMethod === 'random') {
      seededTeams = this.shuffleArray(input.teamNames);
    }

    // Generate bracket based on type
    const rounds = input.type === 'single-elimination'
      ? this.generateSingleEliminationRounds(seededTeams, input.questionSetsByRound)
      : this.generateDoubleEliminationRounds(seededTeams, input.questionSetsByRound);

    const tournament: Tournament = {
      tournamentID,
      name: input.name,
      type: input.type,
      status: 'in-progress',
      teamNames: seededTeams,
      datasetId: input.datasetId,
      rounds,
      createdAt: now,
      updatedAt: now
    };

    await this.dbService.addTournament(tournament);
    return tournament;
  }

  // Generate single elimination bracket rounds
  // Uses a compact bracket structure that minimizes byes
  // For N teams: first round has (N - 2^floor(log2(N))) play-in matches
  // Higher seeds get byes to the main bracket
  private generateSingleEliminationRounds(
    teams: string[],
    questionSetsByRound: Map<number, string>
  ): TournamentRound[] {
    const teamCount = teams.length;

    // Calculate compact bracket structure
    const mainBracketSize = this.nextPowerOf2(teamCount);
    const lowerPowerOf2 = mainBracketSize / 2;

    // Number of teams that need to play in round 1 (play-in round)
    // These are the lowest seeds that must compete to fill the main bracket
    const playInTeams = (teamCount - lowerPowerOf2) * 2;
    const byeTeams = teamCount - playInTeams; // Teams that skip to round 2
    const playInMatches = playInTeams / 2;

    // If no play-in needed (power of 2 teams), use simple bracket
    if (playInMatches === 0 || teamCount <= 2) {
      return this.generateSimpleBracket(teams, questionSetsByRound);
    }

    const rounds: TournamentRound[] = [];
    const totalRounds = Math.ceil(Math.log2(teamCount));

    // Round 1: Play-in matches for lowest seeds
    // Teams that play in round 1 are the bottom (playInTeams) seeds
    const round1Matches: TournamentMatch[] = [];
    const playInStartSeed = byeTeams + 1; // First seed that must play in round 1

    for (let i = 0; i < playInMatches; i++) {
      // Pair lowest seeds: e.g., for 5 teams with 2 play-in teams, seed 4 vs seed 5
      const seed1 = playInStartSeed + i;
      const seed2 = teamCount - i;

      const team1 = teams[seed1 - 1];
      const team2 = teams[seed2 - 1];

      const matchID = this.generateMatchID(1, i, 'winners');

      // Winner advances to round 2
      // Position in round 2 is based on where they fit in the seeding
      const r2Position = Math.floor((lowerPowerOf2 - 1 - i) / 2);
      const r2Slot: 'team1' | 'team2' = (lowerPowerOf2 - 1 - i) % 2 === 0 ? 'team1' : 'team2';

      const match: TournamentMatch = {
        matchID,
        position: i,
        quizNumber: 0,
        team1Slot: { type: 'team', teamName: team1 },
        team2Slot: { type: 'team', teamName: team2 },
        result: null,
        winnerAdvancesTo: {
          bracketType: 'winners',
          roundNumber: 2,
          matchPosition: r2Position,
          slot: r2Slot
        },
        loserAdvancesTo: null
      };

      round1Matches.push(match);
    }

    if (round1Matches.length > 0) {
      rounds.push({
        roundNumber: 1,
        bracketType: 'winners',
        name: playInMatches === 1 ? 'Play-in' : 'Round 1',
        questionSetId: questionSetsByRound.get(1) || '',
        matches: round1Matches
      });
    }

    // Round 2 and beyond: Standard bracket with bye teams seeded in
    // Build round 2 with bye teams in their seeded positions
    const round2Matches: TournamentMatch[] = [];
    const round2MatchCount = lowerPowerOf2 / 2;

    for (let i = 0; i < round2MatchCount; i++) {
      const matchID = this.generateMatchID(2, i, 'winners');

      // Determine team1 and team2 based on standard seeding
      // In a bracket of size lowerPowerOf2, position i has seeds based on standard pairing
      const pairings = this.generateSeedPairings(lowerPowerOf2);
      const [seedA, seedB] = pairings[i];

      // seedA and seedB are positions 1 to lowerPowerOf2
      // Seeds 1 to byeTeams are byes (direct placement)
      // Seeds byeTeams+1 to lowerPowerOf2 come from round 1 winners

      let team1Slot: TeamSlot;
      let team2Slot: TeamSlot;

      if (seedA <= byeTeams) {
        // This is a bye team, directly seeded
        team1Slot = { type: 'team', teamName: teams[seedA - 1] };
      } else {
        // This comes from a round 1 match
        const r1MatchIndex = seedA - byeTeams - 1;
        team1Slot = {
          type: 'winner-of',
          sourceMatchId: this.generateMatchID(1, r1MatchIndex, 'winners')
        };
      }

      if (seedB <= byeTeams) {
        team2Slot = { type: 'team', teamName: teams[seedB - 1] };
      } else {
        const r1MatchIndex = seedB - byeTeams - 1;
        team2Slot = {
          type: 'winner-of',
          sourceMatchId: this.generateMatchID(1, r1MatchIndex, 'winners')
        };
      }

      const nextRoundPosition = Math.floor(i / 2);
      const nextSlot: 'team1' | 'team2' = i % 2 === 0 ? 'team1' : 'team2';

      const match: TournamentMatch = {
        matchID,
        position: i,
        quizNumber: 0,
        team1Slot,
        team2Slot,
        result: null,
        winnerAdvancesTo: round2MatchCount > 1 ? {
          bracketType: 'winners',
          roundNumber: 3,
          matchPosition: nextRoundPosition,
          slot: nextSlot
        } : null,
        loserAdvancesTo: null
      };

      round2Matches.push(match);
    }

    rounds.push({
      roundNumber: 2,
      bracketType: 'winners',
      name: this.getRoundName(round2MatchCount, 2, totalRounds, 'winners'),
      questionSetId: questionSetsByRound.get(2) || '',
      matches: round2Matches
    });

    // Generate remaining rounds
    let matchesInPrevRound = round2MatchCount;
    for (let r = 3; r <= totalRounds; r++) {
      const matchesInRound = matchesInPrevRound / 2;
      const roundMatches: TournamentMatch[] = [];

      for (let i = 0; i < matchesInRound; i++) {
        const matchID = this.generateMatchID(r, i, 'winners');
        const prevRound = rounds[rounds.length - 1];

        const team1SourceMatch = prevRound.matches[i * 2];
        const team2SourceMatch = prevRound.matches[i * 2 + 1];

        const team1Slot: TeamSlot = {
          type: 'winner-of',
          sourceMatchId: team1SourceMatch.matchID
        };

        const team2Slot: TeamSlot = {
          type: 'winner-of',
          sourceMatchId: team2SourceMatch.matchID
        };

        const nextRoundPosition = Math.floor(i / 2);
        const nextSlot: 'team1' | 'team2' = i % 2 === 0 ? 'team1' : 'team2';

        const match: TournamentMatch = {
          matchID,
          position: i,
          quizNumber: 0,
          team1Slot,
          team2Slot,
          result: null,
          winnerAdvancesTo: r < totalRounds ? {
            bracketType: 'winners',
            roundNumber: r + 1,
            matchPosition: nextRoundPosition,
            slot: nextSlot
          } : null,
          loserAdvancesTo: null
        };

        roundMatches.push(match);
      }

      rounds.push({
        roundNumber: r,
        bracketType: 'winners',
        name: this.getRoundName(matchesInRound, r, totalRounds, 'winners'),
        questionSetId: questionSetsByRound.get(r) || '',
        matches: roundMatches
      });

      matchesInPrevRound = matchesInRound;
    }

    // Assign quiz numbers
    this.assignQuizNumbers(rounds);

    return rounds;
  }

  // Simple bracket for power-of-2 team counts
  private generateSimpleBracket(
    teams: string[],
    questionSetsByRound: Map<number, string>
  ): TournamentRound[] {
    const teamCount = teams.length;
    const totalRounds = Math.log2(teamCount);
    const rounds: TournamentRound[] = [];
    const pairings = this.generateSeedPairings(teamCount);

    // Round 1
    const round1Matches: TournamentMatch[] = [];
    for (let i = 0; i < pairings.length; i++) {
      const [seed1, seed2] = pairings[i];
      const matchID = this.generateMatchID(1, i, 'winners');

      const nextRoundPosition = Math.floor(i / 2);
      const nextSlot: 'team1' | 'team2' = i % 2 === 0 ? 'team1' : 'team2';

      const match: TournamentMatch = {
        matchID,
        position: i,
        quizNumber: 0,
        team1Slot: { type: 'team', teamName: teams[seed1 - 1] },
        team2Slot: { type: 'team', teamName: teams[seed2 - 1] },
        result: null,
        winnerAdvancesTo: totalRounds > 1 ? {
          bracketType: 'winners',
          roundNumber: 2,
          matchPosition: nextRoundPosition,
          slot: nextSlot
        } : null,
        loserAdvancesTo: null
      };

      round1Matches.push(match);
    }

    rounds.push({
      roundNumber: 1,
      bracketType: 'winners',
      name: this.getRoundName(round1Matches.length, 1, totalRounds, 'winners'),
      questionSetId: questionSetsByRound.get(1) || '',
      matches: round1Matches
    });

    // Subsequent rounds
    let matchesInPrevRound = round1Matches.length;
    for (let r = 2; r <= totalRounds; r++) {
      const matchesInRound = matchesInPrevRound / 2;
      const roundMatches: TournamentMatch[] = [];

      for (let i = 0; i < matchesInRound; i++) {
        const matchID = this.generateMatchID(r, i, 'winners');
        const prevRound = rounds[r - 2];

        // Team slots come from winners of previous round
        const team1SourceMatch = prevRound.matches[i * 2];
        const team2SourceMatch = prevRound.matches[i * 2 + 1];

        const team1Slot: TeamSlot = {
          type: 'winner-of',
          sourceMatchId: team1SourceMatch.matchID
        };

        const team2Slot: TeamSlot = {
          type: 'winner-of',
          sourceMatchId: team2SourceMatch.matchID
        };

        // Calculate advancement for next round
        const nextRoundPosition = Math.floor(i / 2);
        const nextSlot: 'team1' | 'team2' = i % 2 === 0 ? 'team1' : 'team2';

        const match: TournamentMatch = {
          matchID,
          position: i,
          quizNumber: 0, // Will be assigned later by scheduling algorithm
          team1Slot,
          team2Slot,
          result: null,
          winnerAdvancesTo: r < totalRounds ? {
            bracketType: 'winners',
            roundNumber: r + 1,
            matchPosition: nextRoundPosition,
            slot: nextSlot
          } : null,
          loserAdvancesTo: null
        };

        roundMatches.push(match);
      }

      rounds.push({
        roundNumber: r,
        bracketType: 'winners',
        name: this.getRoundName(matchesInRound, r, totalRounds, 'winners'),
        questionSetId: questionSetsByRound.get(r) || '',
        matches: roundMatches
      });

      matchesInPrevRound = matchesInRound;
    }

    // Propagate bye results through the bracket
    this.propagateByeResults(rounds);

    // Assign optimal quiz numbers for play order
    this.assignQuizNumbers(rounds);

    return rounds;
  }

  // Generate double elimination bracket rounds
  // Rules:
  // 1. Every team starts in Winners Bracket Round 1
  // 2. Losing in Winners drops you to Losers Bracket
  // 3. Losing in Losers eliminates you
  // 4. Winners Bracket winner vs Losers Bracket winner in Championship
  // 5. If Losers winner beats Winners winner, a reset match is played
  //
  // Structure for N teams:
  // - Winners R1 has floor(N/2) matches
  // - If N is odd, 1 team gets a bye (top seed)
  // - Losers bracket alternates: drop-in rounds (winners losers enter) and elimination rounds
  private generateDoubleEliminationRounds(
    teams: string[],
    questionSetsByRound: Map<number, string>
  ): TournamentRound[] {
    const teamCount = teams.length;

    if (teamCount < 2) {
      return [];
    }

    // All teams start in Winners Round 1
    // Number of matches = floor(N/2)
    // If odd number of teams, 1 team (top seed) gets a bye
    const round1MatchCount = Math.floor(teamCount / 2);
    const hasOddTeams = teamCount % 2 === 1;

    // Calculate total winners bracket rounds
    // After R1: we have round1MatchCount winners + (1 if odd, bye advances)
    // That's ceil(teamCount/2) teams going to R2
    const teamsAfterR1 = Math.ceil(teamCount / 2);
    const totalWinnersRounds = Math.ceil(Math.log2(teamCount));

    const allRounds: TournamentRound[] = [];
    let globalRoundNum = 1;

    // ========== WINNERS BRACKET ==========

    // Winners Round 1: All teams participate
    // Seeding: 1 vs N, 2 vs N-1, 3 vs N-2, etc.
    // If odd teams, top seed (1) gets a bye
    const round1Matches: TournamentMatch[] = [];

    if (hasOddTeams) {
      // Top seed gets a bye - create a bye match
      const byeMatchID = this.generateMatchID(1, 0, 'winners');
      const byeMatch: TournamentMatch = {
        matchID: byeMatchID,
        position: 0,
        quizNumber: 0,
        team1Slot: { type: 'team', teamName: teams[0] }, // Seed 1
        team2Slot: { type: 'bye' },
        result: null, // Will be auto-resolved
        winnerAdvancesTo: {
          bracketType: 'winners',
          roundNumber: 2,
          matchPosition: 0,
          slot: 'team1'
        },
        loserAdvancesTo: null // Bye match has no real loser
      };
      round1Matches.push(byeMatch);

      // Remaining matches: seed 2 vs N, 3 vs N-1, etc.
      for (let i = 0; i < round1MatchCount; i++) {
        const seed1 = i + 2; // Start from seed 2
        const seed2 = teamCount - i; // Pair with bottom seeds
        const matchID = this.generateMatchID(1, i + 1, 'winners');

        // Calculate R2 advancement position
        // With bye: position 0 is taken by bye winner, so matches go to positions 1, 2, etc.
        // But we need to pair them properly in R2
        const r2Position = Math.floor((i + 1) / 2);
        const r2Slot: 'team1' | 'team2' = (i + 1) % 2 === 0 ? 'team1' : 'team2';

        const match: TournamentMatch = {
          matchID,
          position: i + 1,
          quizNumber: 0,
          team1Slot: { type: 'team', teamName: teams[seed1 - 1] },
          team2Slot: { type: 'team', teamName: teams[seed2 - 1] },
          result: null,
          winnerAdvancesTo: {
            bracketType: 'winners',
            roundNumber: 2,
            matchPosition: r2Position,
            slot: r2Slot
          },
          loserAdvancesTo: {
            bracketType: 'losers',
            roundNumber: 1,
            matchPosition: i,
            slot: 'team1'
          }
        };
        round1Matches.push(match);
      }
    } else {
      // Even number of teams - standard seeding
      // Seed 1 vs N, 2 vs N-1, etc.
      for (let i = 0; i < round1MatchCount; i++) {
        const seed1 = i + 1;
        const seed2 = teamCount - i;
        const matchID = this.generateMatchID(1, i, 'winners');

        const r2Position = Math.floor(i / 2);
        const r2Slot: 'team1' | 'team2' = i % 2 === 0 ? 'team1' : 'team2';

        const match: TournamentMatch = {
          matchID,
          position: i,
          quizNumber: 0,
          team1Slot: { type: 'team', teamName: teams[seed1 - 1] },
          team2Slot: { type: 'team', teamName: teams[seed2 - 1] },
          result: null,
          winnerAdvancesTo: round1MatchCount === 1 ? {
            bracketType: 'finals',
            roundNumber: 1,
            matchPosition: 0,
            slot: 'team1'
          } : {
            bracketType: 'winners',
            roundNumber: 2,
            matchPosition: r2Position,
            slot: r2Slot
          },
          loserAdvancesTo: {
            bracketType: 'losers',
            roundNumber: 1,
            matchPosition: i,
            slot: 'team1'
          }
        };
        round1Matches.push(match);
      }
    }

    // Round name for Winners R1
    let r1Name: string;
    if (round1MatchCount === 1 && !hasOddTeams) {
      r1Name = 'Winners Final';
    } else if (round1MatchCount <= 2) {
      r1Name = 'Winners Semifinals';
    } else if (round1MatchCount <= 4) {
      r1Name = 'Winners Quarterfinals';
    } else {
      r1Name = 'Winners Round 1';
    }

    allRounds.push({
      roundNumber: 1,
      bracketType: 'winners',
      name: r1Name,
      questionSetId: questionSetsByRound.get(globalRoundNum++) || '',
      matches: round1Matches
    });

    // Subsequent Winners Bracket rounds
    let currentWinnersMatchCount = Math.ceil(round1Matches.length / 2);
    if (hasOddTeams) {
      // Bye match winner + floor((round1MatchCount) / 2) match pairs
      currentWinnersMatchCount = Math.ceil((round1MatchCount + 1) / 2);
    }

    for (let wr = 2; wr <= totalWinnersRounds; wr++) {
      if (currentWinnersMatchCount < 1) break;

      const roundMatches: TournamentMatch[] = [];
      const prevRound = allRounds.find(
        r => r.bracketType === 'winners' && r.roundNumber === wr - 1
      )!;

      const isFinalRound = currentWinnersMatchCount === 1;

      for (let i = 0; i < currentWinnersMatchCount; i++) {
        const matchID = this.generateMatchID(wr, i, 'winners');

        // Get source matches from previous round
        const sourceMatch1Index = i * 2;
        const sourceMatch2Index = i * 2 + 1;

        let team1Slot: TeamSlot;
        let team2Slot: TeamSlot;

        if (sourceMatch1Index < prevRound.matches.length) {
          team1Slot = {
            type: 'winner-of',
            sourceMatchId: prevRound.matches[sourceMatch1Index].matchID
          };
        } else {
          team1Slot = { type: 'bye' };
        }

        if (sourceMatch2Index < prevRound.matches.length) {
          team2Slot = {
            type: 'winner-of',
            sourceMatchId: prevRound.matches[sourceMatch2Index].matchID
          };
        } else {
          team2Slot = { type: 'bye' };
        }

        // Losers from this round go to losers bracket
        // Each winners round feeds into a specific losers round
        const losersDropRound = (wr - 1) * 2;

        const match: TournamentMatch = {
          matchID,
          position: i,
          quizNumber: 0,
          team1Slot,
          team2Slot,
          result: null,
          winnerAdvancesTo: isFinalRound ? {
            bracketType: 'finals',
            roundNumber: 1,
            matchPosition: 0,
            slot: 'team1'
          } : {
            bracketType: 'winners',
            roundNumber: wr + 1,
            matchPosition: Math.floor(i / 2),
            slot: i % 2 === 0 ? 'team1' : 'team2'
          },
          loserAdvancesTo: {
            bracketType: 'losers',
            roundNumber: losersDropRound,
            matchPosition: i,
            slot: 'team2'
          }
        };

        roundMatches.push(match);
      }

      // Determine round name
      let roundName: string;
      if (currentWinnersMatchCount === 1) {
        roundName = 'Winners Final';
      } else if (currentWinnersMatchCount === 2) {
        roundName = 'Winners Semifinals';
      } else if (currentWinnersMatchCount === 4) {
        roundName = 'Winners Quarterfinals';
      } else {
        roundName = `Winners Round ${wr}`;
      }

      allRounds.push({
        roundNumber: wr,
        bracketType: 'winners',
        name: roundName,
        questionSetId: questionSetsByRound.get(globalRoundNum++) || '',
        matches: roundMatches
      });

      currentWinnersMatchCount = Math.ceil(currentWinnersMatchCount / 2);
    }

    // ========== LOSERS BRACKET ==========
    // Double elimination losers bracket structure:
    // - Every team that loses in Winners Bracket drops to Losers Bracket
    // - Losing in Losers Bracket = eliminated (2nd loss overall)
    // - The loser bracket champion faces the winners bracket champion
    //
    // For each Winners round (except the last), losers drop into LB.
    // The LB must absorb these losers while reducing its own field.
    //
    // Structure pattern for losers bracket:
    // - L Round 1: W1 losers face each other
    // - L Round 2: L1 winners face W2 losers
    // - L Round 3: L2 winners face each other (if needed)
    // - L Round 4: L3 winners face W3 losers
    // - etc.

    const winnersRounds = allRounds.filter(r => r.bracketType === 'winners');
    const winnersRoundCount = winnersRounds.length;

    // Build a complete picture of how many losers come from each winners round
    // A match produces a loser if BOTH teams are real (not byes)
    // Note: A match where one team comes from a bye match is still real!
    const loserSourcesByWRound: Map<number, TournamentMatch[]> = new Map();
    for (const wRound of winnersRounds) {
      // Filter: both slots must not be direct 'bye' type
      const matchesWithLosers = wRound.matches.filter(m =>
        m.team1Slot.type !== 'bye' && m.team2Slot.type !== 'bye'
      );
      loserSourcesByWRound.set(wRound.roundNumber, matchesWithLosers);
    }

    // We need to generate losers bracket rounds
    // The number of rounds depends on the total losers we need to process
    // For N teams: we'll have N-1 total losers across all winners rounds
    // The losers bracket needs enough rounds to reduce N-1 teams to 1

    // Build the losers bracket incrementally
    // Track: current teams in LB, which W round's losers drop in next
    let lbTeamSources: { type: 'winner-of' | 'loser-of'; matchId: string }[] = [];
    let losersRoundNum = 1;
    let nextWRoundToFeedFrom = 1; // Which winners round's losers drop in

    // Initialize with W1 losers
    const w1LoserMatches = loserSourcesByWRound.get(1) || [];
    for (const m of w1LoserMatches) {
      lbTeamSources.push({ type: 'loser-of', matchId: m.matchID });
    }

    // Continue until we've processed all winners rounds' losers and reduced to 1 team
    while (lbTeamSources.length > 1 || nextWRoundToFeedFrom < winnersRoundCount) {
      const roundMatches: TournamentMatch[] = [];

      // Determine if this is a drop-in round (new losers from winners join)
      // After L1, every other round is a drop-in round: L2, L4, L6...
      // The pattern: L1=elimination, L2=drop-in, L3=elimination, L4=drop-in, etc.
      // But we also need to check if there ARE more losers to drop in
      const isDropInRound = losersRoundNum % 2 === 0;
      const feedingWRound = isDropInRound ? (losersRoundNum / 2) + 1 : 0;
      const canDropIn = isDropInRound && feedingWRound <= winnersRoundCount;

      let newWBLosers: { type: 'loser-of'; matchId: string }[] = [];
      if (canDropIn) {
        const wbLoserMatches = loserSourcesByWRound.get(feedingWRound) || [];
        for (const m of wbLoserMatches) {
          newWBLosers.push({ type: 'loser-of', matchId: m.matchID });
        }
        if (feedingWRound > nextWRoundToFeedFrom) {
          nextWRoundToFeedFrom = feedingWRound;
        }
      }

      if (!isDropInRound || newWBLosers.length === 0) {
        // ELIMINATION ROUND: LB teams face each other
        // Pair them up; if odd count, one gets a bye (auto-advances)
        const numTeams = lbTeamSources.length;

        if (numTeams === 0) {
          // No teams to process, skip this round
          losersRoundNum++;
          continue;
        }

        if (numTeams === 1) {
          // Only one team - they're waiting for more losers to drop in
          // Check if there are more winners rounds to process
          if (nextWRoundToFeedFrom >= winnersRoundCount) {
            // No more drop-ins coming - this team goes to finals
            break;
          }
          // Otherwise, keep the team and move to next round (should be drop-in)
          losersRoundNum++;
          continue;
        }

        // Create elimination matches
        const numMatches = Math.floor(numTeams / 2);
        const hasOddTeam = numTeams % 2 === 1;

        for (let i = 0; i < numMatches; i++) {
          const matchID = this.generateMatchID(losersRoundNum, i, 'losers');
          const src1 = lbTeamSources[i * 2];
          const src2 = lbTeamSources[i * 2 + 1];

          const match: TournamentMatch = {
            matchID,
            position: i,
            quizNumber: 0,
            team1Slot: { type: src1.type, sourceMatchId: src1.matchId },
            team2Slot: { type: src2.type, sourceMatchId: src2.matchId },
            result: null,
            winnerAdvancesTo: {
              bracketType: 'losers',
              roundNumber: losersRoundNum + 1,
              matchPosition: i,
              slot: 'team1'
            },
            loserAdvancesTo: null // Eliminated
          };
          roundMatches.push(match);
        }

        // Update team sources: winners advance, odd team gets bye
        const newSources: typeof lbTeamSources = [];
        for (const m of roundMatches) {
          newSources.push({ type: 'winner-of', matchId: m.matchID });
        }
        if (hasOddTeam) {
          // Odd team gets a bye - add them as-is
          const oddTeam = lbTeamSources[numMatches * 2];
          newSources.push(oddTeam);
        }
        lbTeamSources = newSources;

      } else {
        // DROP-IN ROUND: LB survivors face new losers from winners bracket
        const lbCount = lbTeamSources.length;
        const wbCount = newWBLosers.length;

        // Pair them 1:1. If counts differ, extras get byes
        const numMatches = Math.max(lbCount, wbCount);

        for (let i = 0; i < numMatches; i++) {
          const matchID = this.generateMatchID(losersRoundNum, i, 'losers');

          let team1Slot: TeamSlot;
          let team2Slot: TeamSlot;

          // Team 1: LB survivor
          if (i < lbCount) {
            const src = lbTeamSources[i];
            team1Slot = { type: src.type, sourceMatchId: src.matchId };
          } else {
            team1Slot = { type: 'bye' };
          }

          // Team 2: New loser from winners
          if (i < wbCount) {
            const src = newWBLosers[i];
            team2Slot = { type: src.type, sourceMatchId: src.matchId };
          } else {
            team2Slot = { type: 'bye' };
          }

          const match: TournamentMatch = {
            matchID,
            position: i,
            quizNumber: 0,
            team1Slot,
            team2Slot,
            result: null,
            winnerAdvancesTo: {
              bracketType: 'losers',
              roundNumber: losersRoundNum + 1,
              matchPosition: i,
              slot: 'team1'
            },
            loserAdvancesTo: null // Eliminated
          };
          roundMatches.push(match);
        }

        // Update team sources
        lbTeamSources = roundMatches.map(m => ({ type: 'winner-of' as const, matchId: m.matchID }));
      }

      // Add round if it has matches
      if (roundMatches.length > 0) {
        allRounds.push({
          roundNumber: losersRoundNum,
          bracketType: 'losers',
          name: `L Round ${losersRoundNum}`,
          questionSetId: questionSetsByRound.get(globalRoundNum++) || '',
          matches: roundMatches
        });
      }

      losersRoundNum++;

      // Safety: prevent infinite loop
      if (losersRoundNum > 20) {
        console.error('Losers bracket generation exceeded 20 rounds - breaking');
        break;
      }
    }

    // Fix winnerAdvancesTo for losers bracket matches
    // Some rounds may be skipped (e.g., L3 with only 1 team), so we need to update
    // references to point to the next actual round
    const losersRounds = allRounds.filter(r => r.bracketType === 'losers');
    const losersRoundNumbers = new Set(losersRounds.map(r => r.roundNumber));

    for (const lRound of losersRounds) {
      for (const match of lRound.matches) {
        if (match.winnerAdvancesTo && match.winnerAdvancesTo.bracketType === 'losers') {
          // Find the next actual losers round
          let nextRoundNum = match.winnerAdvancesTo.roundNumber;
          while (nextRoundNum <= 20 && !losersRoundNumbers.has(nextRoundNum)) {
            nextRoundNum++;
          }
          if (losersRoundNumbers.has(nextRoundNum)) {
            match.winnerAdvancesTo.roundNumber = nextRoundNum;
          }
        }
      }
    }

    // Find the last losers round and rename it to "L Final"
    // Also update the final match's winnerAdvancesTo to point to finals
    if (losersRounds.length > 0) {
      const lastLosersRound = losersRounds[losersRounds.length - 1];
      lastLosersRound.name = 'L Final';

      // Update advancement for the final losers match
      for (const match of lastLosersRound.matches) {
        match.winnerAdvancesTo = {
          bracketType: 'finals',
          roundNumber: 1,
          matchPosition: 0,
          slot: 'team2'
        };
      }
    }

    // ========== CHAMPIONSHIP ==========
    const winnersChamp = allRounds
      .filter(r => r.bracketType === 'winners')
      .sort((a, b) => b.roundNumber - a.roundNumber)[0];

    const losersChamp = allRounds
      .filter(r => r.bracketType === 'losers')
      .sort((a, b) => b.roundNumber - a.roundNumber)[0];

    if (winnersChamp && losersChamp) {
      // Championship Match
      const championship: TournamentMatch = {
        matchID: this.generateMatchID(1, 0, 'finals'),
        position: 0,
        quizNumber: 0,
        team1Slot: {
          type: 'winner-of',
          sourceMatchId: winnersChamp.matches[0].matchID
        },
        team2Slot: {
          type: 'winner-of',
          sourceMatchId: losersChamp.matches[0].matchID
        },
        result: null,
        winnerAdvancesTo: null, // Winner is champion (unless reset needed)
        loserAdvancesTo: null   // If winners bracket team loses, reset match happens
      };

      allRounds.push({
        roundNumber: 1,
        bracketType: 'finals',
        name: 'Championship',
        questionSetId: questionSetsByRound.get(globalRoundNum++) || '',
        matches: [championship]
      });
    }

    // Note: Reset match would be handled at runtime if the losers bracket winner
    // beats the winners bracket winner. For now, we generate the structure
    // and the UI/logic can handle adding a reset if needed.

    // Propagate bye results through the entire bracket
    this.propagateByeResults(allRounds);

    // Assign optimal quiz numbers for play order
    this.assignQuizNumbers(allRounds);

    return allRounds;
  }

  // Propagate results from bye matches through the bracket
  // This handles both winners advancement and losers bracket byes
  private propagateByeResults(rounds: TournamentRound[]): void {
    // Build a map of match IDs to their matches for quick lookup
    const matchMap = new Map<string, TournamentMatch>();
    for (const round of rounds) {
      for (const match of round.matches) {
        matchMap.set(match.matchID, match);
      }
    }

    // Keep processing until no more changes
    let changed = true;
    let iterations = 0;
    const maxIterations = 100; // Safety limit

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const round of rounds) {
        for (const match of round.matches) {
          // If match has a result, advance the winner (and handle loser for losers bracket)
          if (match.result && match.result.winnerTeamName) {
            // Advance winner
            if (match.winnerAdvancesTo) {
              const targetRound = rounds.find(r =>
                r.bracketType === match.winnerAdvancesTo!.bracketType &&
                r.roundNumber === match.winnerAdvancesTo!.roundNumber
              );
              if (targetRound) {
                const targetMatch = targetRound.matches[match.winnerAdvancesTo.matchPosition];
                if (targetMatch) {
                  const slot = match.winnerAdvancesTo.slot === 'team1'
                    ? targetMatch.team1Slot
                    : targetMatch.team2Slot;

                  // Only update if it's still a reference type
                  if (slot.type === 'winner-of' || slot.type === 'loser-of') {
                    slot.type = 'team';
                    slot.teamName = match.result.winnerTeamName;
                    slot.sourceMatchId = undefined;
                    changed = true;
                  }
                }
              }
            }
          }

          // Handle loser-of slots that reference bye matches
          if (!match.result) {
            const checkAndConvertToBye = (slot: TeamSlot): boolean => {
              if (slot.type === 'loser-of' && slot.sourceMatchId) {
                const sourceMatch = matchMap.get(slot.sourceMatchId);
                if (sourceMatch?.result && sourceMatch.result.loserTeamName === '') {
                  // Source was a bye match - convert this slot to bye
                  slot.type = 'bye';
                  slot.sourceMatchId = undefined;
                  return true;
                }
              }
              return false;
            };

            const slot1Changed = checkAndConvertToBye(match.team1Slot);
            const slot2Changed = checkAndConvertToBye(match.team2Slot);

            if (slot1Changed || slot2Changed) {
              changed = true;
            }

            // Auto-resolve if one slot is a bye
            if (match.team1Slot.type === 'bye' && match.team2Slot.type !== 'bye') {
              const team2Name = this.resolveTeamSlotFromRounds(match.team2Slot, rounds, matchMap);
              if (team2Name) {
                match.result = {
                  team1Score: 0,
                  team2Score: 0,
                  winnerTeamName: team2Name,
                  loserTeamName: '',
                  playedLocally: false,
                  completedAt: new Date().toISOString()
                };
                changed = true;
              }
            } else if (match.team2Slot.type === 'bye' && match.team1Slot.type !== 'bye') {
              const team1Name = this.resolveTeamSlotFromRounds(match.team1Slot, rounds, matchMap);
              if (team1Name) {
                match.result = {
                  team1Score: 0,
                  team2Score: 0,
                  winnerTeamName: team1Name,
                  loserTeamName: '',
                  playedLocally: false,
                  completedAt: new Date().toISOString()
                };
                changed = true;
              }
            } else if (match.team1Slot.type === 'bye' && match.team2Slot.type === 'bye') {
              // Both are byes
              match.result = {
                team1Score: 0,
                team2Score: 0,
                winnerTeamName: '',
                loserTeamName: '',
                playedLocally: false,
                completedAt: new Date().toISOString()
              };
              changed = true;
            }
          }
        }
      }
    }
  }

  // Helper to resolve team slot using rounds array (before tournament is saved)
  // This now supports recursive resolution - tracing back through winner-of/loser-of chains
  // to find the original team name even when intermediate matches haven't been played
  private resolveTeamSlotFromRounds(
    slot: TeamSlot,
    rounds: TournamentRound[],
    matchResults: Map<string, TournamentMatch>,
    visited: Set<string> = new Set()
  ): string | null {
    if (slot.type === 'team') {
      return slot.teamName || null;
    }

    if (slot.type === 'bye') {
      return null;
    }

    if ((slot.type === 'winner-of' || slot.type === 'loser-of') && slot.sourceMatchId) {
      // Prevent infinite loops
      if (visited.has(slot.sourceMatchId)) {
        return null;
      }
      visited.add(slot.sourceMatchId);

      const sourceMatch = matchResults.get(slot.sourceMatchId);
      if (!sourceMatch) {
        return null;
      }

      // If source match has a result, use it
      if (sourceMatch.result) {
        return slot.type === 'winner-of'
          ? sourceMatch.result.winnerTeamName
          : sourceMatch.result.loserTeamName;
      }

      // If source match doesn't have a result yet, try to trace further
      // This is useful for bye matches where we can determine the winner
      // by following the chain to the original team

      // Check if source match is a bye match itself
      const team1IsBye = sourceMatch.team1Slot.type === 'bye';
      const team2IsBye = sourceMatch.team2Slot.type === 'bye';

      if (team1IsBye && !team2IsBye && slot.type === 'winner-of') {
        // team2 wins by bye, resolve team2
        return this.resolveTeamSlotFromRounds(sourceMatch.team2Slot, rounds, matchResults, visited);
      } else if (team2IsBye && !team1IsBye && slot.type === 'winner-of') {
        // team1 wins by bye, resolve team1
        return this.resolveTeamSlotFromRounds(sourceMatch.team1Slot, rounds, matchResults, visited);
      }

      // For non-bye matches without results, we can't determine the winner/loser
      return null;
    }

    return null;
  }

  // Resolve a team slot to an actual team name
  // Supports recursive resolution through winner-of/loser-of chains for bye matches
  resolveTeamSlot(slot: TeamSlot, tournament: Tournament, visited: Set<string> = new Set()): string | null {
    if (slot.type === 'team') {
      return slot.teamName || null;
    }

    if (slot.type === 'bye') {
      return null;
    }

    if (slot.type === 'winner-of' || slot.type === 'loser-of') {
      // Prevent infinite loops
      if (slot.sourceMatchId && visited.has(slot.sourceMatchId)) {
        return null;
      }
      if (slot.sourceMatchId) {
        visited.add(slot.sourceMatchId);
      }

      // Find the source match
      const sourceMatch = this.findMatch(tournament, slot.sourceMatchId!);
      if (!sourceMatch) {
        return null;
      }

      // If source match has a result, use it
      if (sourceMatch.result) {
        return slot.type === 'winner-of'
          ? sourceMatch.result.winnerTeamName
          : sourceMatch.result.loserTeamName;
      }

      // If source match doesn't have a result, check if it's a bye match
      // where we can determine the winner by tracing the chain
      const team1IsBye = sourceMatch.team1Slot.type === 'bye';
      const team2IsBye = sourceMatch.team2Slot.type === 'bye';

      if (team1IsBye && !team2IsBye && slot.type === 'winner-of') {
        // team2 wins by bye
        return this.resolveTeamSlot(sourceMatch.team2Slot, tournament, visited);
      } else if (team2IsBye && !team1IsBye && slot.type === 'winner-of') {
        // team1 wins by bye
        return this.resolveTeamSlot(sourceMatch.team1Slot, tournament, visited);
      }

      return null;
    }

    return null;
  }

  // Find a match by ID
  findMatch(tournament: Tournament, matchID: string): TournamentMatch | null {
    for (const round of tournament.rounds) {
      const match = round.matches.find(m => m.matchID === matchID);
      if (match) return match;
    }
    return null;
  }

  // Find a round containing a match
  findRoundForMatch(tournament: Tournament, matchID: string): TournamentRound | null {
    for (const round of tournament.rounds) {
      if (round.matches.some(m => m.matchID === matchID)) {
        return round;
      }
    }
    return null;
  }

  // Record match result and advance teams
  async recordMatchResult(
    tournamentID: string,
    matchID: string,
    team1Score: number,
    team2Score: number,
    playedLocally: boolean
  ): Promise<Tournament> {
    const tournament = await this.dbService.getTournament(tournamentID);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const match = this.findMatch(tournament, matchID);
    if (!match) {
      throw new Error('Match not found');
    }

    // Resolve team names
    const team1Name = this.resolveTeamSlot(match.team1Slot, tournament);
    const team2Name = this.resolveTeamSlot(match.team2Slot, tournament);

    if (!team1Name || !team2Name) {
      throw new Error('Cannot record result: teams not yet determined');
    }

    if (team1Score === team2Score) {
      throw new Error('Ties are not allowed in elimination matches');
    }

    const winnerTeamName = team1Score > team2Score ? team1Name : team2Name;
    const loserTeamName = team1Score > team2Score ? team2Name : team1Name;

    // Update match result
    match.result = {
      team1Score,
      team2Score,
      winnerTeamName,
      loserTeamName,
      playedLocally,
      completedAt: new Date().toISOString()
    };

    // Save match summary for statistics tracking
    // Use tournament name as the quizID so all tournament matches are grouped together
    const matchSummary: MatchSummary = {
      quizID: tournament.name,
      matchID: matchID,
      team1: team1Name,
      team2: team2Name,
      score1: team1Score,
      score2: team2Score
    };
    await this.dbService.saveMatchSummary(matchSummary);

    // Advance winner
    if (match.winnerAdvancesTo) {
      this.advanceTeam(tournament, match.winnerAdvancesTo, winnerTeamName);
    }

    // Advance loser (double elimination)
    if (match.loserAdvancesTo) {
      this.advanceTeam(tournament, match.loserAdvancesTo, loserTeamName);
    }

    // After advancing teams, check for cascading bye resolutions
    // (e.g., if a team advances into a bye match, auto-resolve it)
    this.resolveByeMatchesCascade(tournament);

    // Check if tournament is complete
    tournament.status = this.checkTournamentComplete(tournament) ? 'completed' : 'in-progress';
    tournament.updatedAt = new Date().toISOString();

    await this.dbService.updateTournament(tournament);
    return tournament;
  }

  // Resolve any bye matches that are now ready (one team determined, other is bye)
  // This cascades - resolving one bye match may enable another
  private resolveByeMatchesCascade(tournament: Tournament): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 50;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const round of tournament.rounds) {
        for (const match of round.matches) {
          // Skip matches that already have results
          if (match.result) continue;

          const team1IsBye = match.team1Slot.type === 'bye';
          const team2IsBye = match.team2Slot.type === 'bye';

          // Check if this is a bye match that can be resolved
          if (team1IsBye && !team2IsBye) {
            // team2 should win - try to resolve the team name
            const team2Name = this.resolveTeamSlot(match.team2Slot, tournament);
            if (team2Name) {
              match.result = {
                team1Score: 0,
                team2Score: 0,
                winnerTeamName: team2Name,
                loserTeamName: '',
                playedLocally: false,
                completedAt: new Date().toISOString()
              };

              // Advance the winner
              if (match.winnerAdvancesTo) {
                this.advanceTeam(tournament, match.winnerAdvancesTo, team2Name);
              }

              changed = true;
            }
          } else if (team2IsBye && !team1IsBye) {
            // team1 should win - try to resolve the team name
            const team1Name = this.resolveTeamSlot(match.team1Slot, tournament);
            if (team1Name) {
              match.result = {
                team1Score: 0,
                team2Score: 0,
                winnerTeamName: team1Name,
                loserTeamName: '',
                playedLocally: false,
                completedAt: new Date().toISOString()
              };

              // Advance the winner
              if (match.winnerAdvancesTo) {
                this.advanceTeam(tournament, match.winnerAdvancesTo, team1Name);
              }

              changed = true;
            }
          } else if (team1IsBye && team2IsBye) {
            // Both are byes - this shouldn't produce a real winner
            match.result = {
              team1Score: 0,
              team2Score: 0,
              winnerTeamName: '',
              loserTeamName: '',
              playedLocally: false,
              completedAt: new Date().toISOString()
            };
            changed = true;
          }
        }
      }
    }
  }

  // Repair/migrate a tournament by resolving any pending bye matches
  // This is useful for tournaments created before the cascade fix
  // Returns true if any changes were made and the tournament should be saved
  async repairTournament(tournamentID: string): Promise<Tournament | null> {
    const tournament = await this.dbService.getTournament(tournamentID);
    if (!tournament) {
      return null;
    }

    // Run the cascade resolution
    const beforeState = JSON.stringify(tournament.rounds);
    this.resolveByeMatchesCascade(tournament);
    const afterState = JSON.stringify(tournament.rounds);

    // If anything changed, save the tournament
    if (beforeState !== afterState) {
      tournament.updatedAt = new Date().toISOString();
      await this.dbService.updateTournament(tournament);
    }

    return tournament;
  }

  // Advance a team to their next match
  private advanceTeam(tournament: Tournament, advancement: MatchAdvancement, teamName: string): void {
    // Find the target round and match by both bracket type and round number
    for (const round of tournament.rounds) {
      if (round.bracketType === advancement.bracketType && round.roundNumber === advancement.roundNumber) {
        const match = round.matches[advancement.matchPosition];
        if (match) {
          const slot = advancement.slot === 'team1' ? match.team1Slot : match.team2Slot;
          // Update the slot to be a direct team reference
          slot.type = 'team';
          slot.teamName = teamName;
          slot.sourceMatchId = undefined;
        }
        break;
      }
    }
  }

  // Check if all matches are complete
  private checkTournamentComplete(tournament: Tournament): boolean {
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        // Skip bye matches
        if (match.team1Slot.type === 'bye' || match.team2Slot.type === 'bye') {
          continue;
        }
        if (!match.result) {
          return false;
        }
      }
    }
    return true;
  }

  // Get the winner of the tournament
  getTournamentWinner(tournament: Tournament): string | null {
    if (tournament.status !== 'completed') {
      return null;
    }

    // Find the finals round
    const finalsRound = tournament.rounds.find(r => r.bracketType === 'finals');
    if (finalsRound && finalsRound.matches.length > 0) {
      const finalMatch = finalsRound.matches[finalsRound.matches.length - 1];
      return finalMatch.result?.winnerTeamName || null;
    }

    // For single elimination, last round of winners bracket
    const winnersRounds = tournament.rounds.filter(r => r.bracketType === 'winners');
    if (winnersRounds.length > 0) {
      const lastRound = winnersRounds[winnersRounds.length - 1];
      if (lastRound.matches.length === 1 && lastRound.matches[0].result) {
        return lastRound.matches[0].result.winnerTeamName;
      }
    }

    return null;
  }

  // Get matches that are ready to be played (both teams determined, not yet played)
  getPlayableMatches(tournament: Tournament): TournamentMatch[] {
    const playable: TournamentMatch[] = [];

    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.result) continue; // Already played
        if (match.team1Slot.type === 'bye' || match.team2Slot.type === 'bye') continue;

        const team1 = this.resolveTeamSlot(match.team1Slot, tournament);
        const team2 = this.resolveTeamSlot(match.team2Slot, tournament);

        if (team1 && team2) {
          playable.push(match);
        }
      }
    }

    return playable;
  }

  // Get the number of rounds for display
  getRoundCount(teamCount: number, type: TournamentType): number {
    if (teamCount < 2) return 0;

    const winnersRounds = Math.ceil(Math.log2(teamCount));

    if (type === 'single-elimination') {
      return winnersRounds;
    } else {
      // Double elimination: winners + losers + championship
      const losersRounds = (winnersRounds - 1) * 2;
      return winnersRounds + losersRounds + 1;
    }
  }

  // Get round names for setup preview
  getRoundNames(teamCount: number, type: TournamentType): string[] {
    if (teamCount < 2) return [];

    const names: string[] = [];
    const totalWinnersRounds = Math.ceil(Math.log2(teamCount));
    const round1MatchCount = Math.floor(teamCount / 2);
    const hasOddTeams = teamCount % 2 === 1;

    // Winners bracket round names
    let matchCount = hasOddTeams ? round1MatchCount + 1 : round1MatchCount;

    for (let r = 1; r <= totalWinnersRounds; r++) {
      const actualMatchCount = r === 1 ? round1MatchCount : matchCount;

      if (actualMatchCount === 1 && !hasOddTeams && r === 1) {
        names.push(type === 'single-elimination' ? 'Finals' : 'Winners Final');
      } else if (actualMatchCount <= 2) {
        names.push(type === 'single-elimination' ? 'Semifinals' : 'Winners Semifinals');
      } else if (actualMatchCount <= 4) {
        names.push(type === 'single-elimination' ? 'Quarterfinals' : 'Winners Quarterfinals');
      } else {
        names.push(type === 'single-elimination' ? `Round ${r}` : `Winners Round ${r}`);
      }

      if (r === 1) {
        matchCount = Math.ceil((hasOddTeams ? round1MatchCount + 1 : round1MatchCount) / 2);
      } else {
        matchCount = Math.ceil(matchCount / 2);
      }
    }

    if (type === 'double-elimination') {
      // Losers bracket round names - use simple L Round X format
      const losersRounds = (totalWinnersRounds - 1) * 2;

      for (let lr = 1; lr <= losersRounds; lr++) {
        const isLastRound = lr === losersRounds;

        if (isLastRound) {
          names.push('L Final');
        } else {
          names.push(`L Round ${lr}`);
        }
      }

      names.push('Championship');
    }

    return names;
  }

  // Assign quiz numbers to all matches in optimal play order
  // Goals:
  // 1. Respect dependencies (a match can't be played until source matches are complete)
  // 2. Give teams rest between matches when possible
  // 3. Keep the tournament moving efficiently
  private assignQuizNumbers(rounds: TournamentRound[]): void {
    // Build match map and dependency graph
    const matchMap = new Map<string, TournamentMatch>();
    const matchRoundMap = new Map<string, TournamentRound>();

    for (const round of rounds) {
      for (const match of round.matches) {
        matchMap.set(match.matchID, match);
        matchRoundMap.set(match.matchID, round);
      }
    }

    // Get all non-bye matches that need scheduling
    const allMatches: TournamentMatch[] = [];
    for (const round of rounds) {
      for (const match of round.matches) {
        // Skip bye matches (both slots are bye or one is bye with auto-result)
        const isBye = match.team1Slot.type === 'bye' || match.team2Slot.type === 'bye';
        if (!isBye) {
          allMatches.push(match);
        } else {
          match.quizNumber = 0; // Bye matches don't get a quiz number
        }
      }
    }

    // Get dependencies for a match (what matches must complete first)
    const getDependencies = (match: TournamentMatch): string[] => {
      const deps: string[] = [];
      for (const slot of [match.team1Slot, match.team2Slot]) {
        if ((slot.type === 'winner-of' || slot.type === 'loser-of') && slot.sourceMatchId) {
          deps.push(slot.sourceMatchId);
        }
      }
      return deps;
    };

    // Get teams involved in a match (resolved or potential)
    const getTeamsInMatch = (match: TournamentMatch): Set<string> => {
      const teams = new Set<string>();

      const resolveSlotTeams = (slot: TeamSlot): void => {
        if (slot.type === 'team' && slot.teamName) {
          teams.add(slot.teamName);
        } else if ((slot.type === 'winner-of' || slot.type === 'loser-of') && slot.sourceMatchId) {
          const sourceMatch = matchMap.get(slot.sourceMatchId);
          if (sourceMatch) {
            resolveSlotTeams(sourceMatch.team1Slot);
            resolveSlotTeams(sourceMatch.team2Slot);
          }
        }
      };

      resolveSlotTeams(match.team1Slot);
      resolveSlotTeams(match.team2Slot);
      return teams;
    };

    // Schedule matches using a greedy algorithm
    const scheduled: TournamentMatch[] = [];
    const scheduledSet = new Set<string>();
    let quizNumber = 1;

    while (scheduled.length < allMatches.length) {
      // Find all matches that can be scheduled now (dependencies met)
      const ready: TournamentMatch[] = [];

      for (const match of allMatches) {
        if (scheduledSet.has(match.matchID)) continue;

        const deps = getDependencies(match);
        const depsReady = deps.every(depId => {
          const depMatch = matchMap.get(depId);
          // Dependency is ready if it's scheduled OR it's a bye match
          return scheduledSet.has(depId) ||
            (depMatch && (depMatch.team1Slot.type === 'bye' || depMatch.team2Slot.type === 'bye'));
        });

        if (depsReady) {
          ready.push(match);
        }
      }

      if (ready.length === 0) {
        // This shouldn't happen if the bracket is valid
        console.error('No ready matches but not all scheduled');
        break;
      }

      // Sort ready matches to minimize team conflicts
      // Priority: matches where teams haven't played recently
      const lastPlayedQuiz = new Map<string, number>();
      for (const m of scheduled) {
        const teams = getTeamsInMatch(m);
        for (const team of teams) {
          lastPlayedQuiz.set(team, m.quizNumber);
        }
      }

      // Score each ready match - higher score = should be scheduled later
      const getMatchScore = (match: TournamentMatch): number => {
        const teams = getTeamsInMatch(match);
        let minGap = Infinity;

        for (const team of teams) {
          const lastQuiz = lastPlayedQuiz.get(team) || 0;
          const gap = quizNumber - lastQuiz;
          minGap = Math.min(minGap, gap);
        }

        // Also consider bracket type priority (winners before losers)
        const round = matchRoundMap.get(match.matchID);
        let bracketPriority = 0;
        if (round) {
          if (round.bracketType === 'winners') bracketPriority = 0;
          else if (round.bracketType === 'losers') bracketPriority = 1;
          else bracketPriority = 2; // finals
        }

        // Lower score = schedule first
        // Prefer matches with larger gaps since last play
        // Tie-break by bracket priority
        return -minGap * 100 + bracketPriority;
      };

      ready.sort((a, b) => getMatchScore(a) - getMatchScore(b));

      // Schedule the best match
      const nextMatch = ready[0];
      nextMatch.quizNumber = quizNumber++;
      scheduled.push(nextMatch);
      scheduledSet.add(nextMatch.matchID);
    }
  }
}
