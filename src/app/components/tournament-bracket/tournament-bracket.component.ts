import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { TournamentService } from '../../services/tournament.service';
import {
  Tournament,
  TournamentRound,
  TournamentMatch,
  BracketType
} from '../../models/tournament.model';

interface MatchDisplay {
  match: TournamentMatch;
  round: TournamentRound;
  team1Name: string | null;
  team2Name: string | null;
  isPlayable: boolean;
  isBye: boolean;
}

@Component({
  selector: 'app-tournament-bracket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tournament-bracket.component.html',
  styleUrl: './tournament-bracket.component.css'
})
export class TournamentBracketComponent implements OnInit {
  tournament: Tournament | null = null;
  loading = true;
  errorMessage = '';

  // Match action dialog
  showMatchDialog = false;
  selectedMatch: MatchDisplay | null = null;

  // Result entry dialog
  showResultDialog = false;
  team1Score = 0;
  team2Score = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dbService: DatabaseService,
    private tournamentService: TournamentService
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadTournament(id);
    } else {
      this.errorMessage = 'Tournament ID not found';
      this.loading = false;
    }
  }

  async loadTournament(id: string) {
    this.loading = true;
    try {
      // Use repairTournament to ensure any pending bye matches are resolved
      // This handles tournaments created before the cascade fix
      this.tournament = await this.tournamentService.repairTournament(id);
      if (!this.tournament) {
        this.errorMessage = 'Tournament not found';
      }
    } catch (error) {
      console.error('Failed to load tournament:', error);
      this.errorMessage = 'Failed to load tournament';
    }
    this.loading = false;
  }

  // Get rounds by bracket type
  getWinnersRounds(): TournamentRound[] {
    return this.tournament?.rounds.filter(r => r.bracketType === 'winners') || [];
  }

  getLosersRounds(): TournamentRound[] {
    return this.tournament?.rounds.filter(r => r.bracketType === 'losers') || [];
  }

  getFinalsRounds(): TournamentRound[] {
    return this.tournament?.rounds.filter(r => r.bracketType === 'finals') || [];
  }

  // Get match display info
  getMatchDisplay(match: TournamentMatch, round: TournamentRound): MatchDisplay {
    if (!this.tournament) {
      return {
        match,
        round,
        team1Name: null,
        team2Name: null,
        isPlayable: false,
        isBye: false
      };
    }

    const team1Name = this.tournamentService.resolveTeamSlot(match.team1Slot, this.tournament);
    const team2Name = this.tournamentService.resolveTeamSlot(match.team2Slot, this.tournament);

    const isBye = match.team1Slot.type === 'bye' || match.team2Slot.type === 'bye';
    const isPlayable = !match.result && !isBye && !!team1Name && !!team2Name;

    return {
      match,
      round,
      team1Name,
      team2Name,
      isPlayable,
      isBye
    };
  }

  // Get team slot display text
  getSlotDisplay(match: TournamentMatch, slot: 'team1' | 'team2'): string {
    const teamSlot = slot === 'team1' ? match.team1Slot : match.team2Slot;

    if (teamSlot.type === 'bye') {
      return 'BYE';
    }

    if (teamSlot.type === 'team' && teamSlot.teamName) {
      return teamSlot.teamName;
    }

    // Try to resolve the actual team name from completed matches
    if (this.tournament && (teamSlot.type === 'winner-of' || teamSlot.type === 'loser-of')) {
      const resolvedName = this.tournamentService.resolveTeamSlot(teamSlot, this.tournament);
      if (resolvedName) {
        return resolvedName;
      }

      // Check if source match exists and get more context
      const sourceMatch = this.tournamentService.findMatch(this.tournament, teamSlot.sourceMatchId!);
      if (sourceMatch) {
        // Check if source match is a bye (one side is bye, no real loser)
        const isByeMatch = sourceMatch.team1Slot.type === 'bye' || sourceMatch.team2Slot.type === 'bye';

        if (teamSlot.type === 'loser-of' && isByeMatch) {
          // Loser of a bye match - there is no loser, show as TBD or BYE
          return 'BYE';
        }

        // Use quiz number if available
        if (sourceMatch.quizNumber > 0) {
          if (teamSlot.type === 'winner-of') {
            return `Winner of Quiz ${sourceMatch.quizNumber}`;
          }
          return `Loser of Quiz ${sourceMatch.quizNumber}`;
        }
      }

      // Ultimate fallback - shouldn't reach here often with proper quiz numbering
      if (teamSlot.type === 'winner-of') {
        return 'TBD';
      }
      return 'TBD';
    }

    return 'TBD';
  }

  // Check if team won
  isWinner(match: TournamentMatch, slot: 'team1' | 'team2'): boolean {
    if (!match.result || !this.tournament) return false;

    const teamSlot = slot === 'team1' ? match.team1Slot : match.team2Slot;
    const teamName = this.tournamentService.resolveTeamSlot(teamSlot, this.tournament);

    return teamName === match.result.winnerTeamName;
  }

  // Open match action dialog
  openMatchDialog(matchDisplay: MatchDisplay) {
    if (matchDisplay.isBye || matchDisplay.match.result) return;

    this.selectedMatch = matchDisplay;
    this.showMatchDialog = true;
  }

  closeMatchDialog() {
    this.showMatchDialog = false;
    this.selectedMatch = null;
  }

  // Play match locally
  playMatch() {
    if (!this.selectedMatch || !this.tournament) return;

    const { match, round } = this.selectedMatch;

    // Store tournament context in sessionStorage
    sessionStorage.setItem('tournamentContext', JSON.stringify({
      tournamentId: this.tournament.tournamentID,
      tournamentName: this.tournament.name,
      matchId: match.matchID,
      team1: this.selectedMatch.team1Name,
      team2: this.selectedMatch.team2Name,
      questionSetId: round.questionSetId
    }));

    // Navigate to match setup with pre-filled data
    this.router.navigate(['/match-setup'], {
      queryParams: {
        tournamentId: this.tournament.tournamentID,
        tournamentName: this.tournament.name,
        matchId: match.matchID,
        team1: this.selectedMatch.team1Name,
        team2: this.selectedMatch.team2Name,
        questionSetId: round.questionSetId
      }
    });
  }

  // Open result entry dialog
  openResultEntry() {
    this.team1Score = 0;
    this.team2Score = 0;
    this.showMatchDialog = false;
    this.showResultDialog = true;
  }

  closeResultDialog() {
    this.showResultDialog = false;
  }

  // Submit manual result
  async submitResult() {
    if (!this.selectedMatch || !this.tournament) return;

    if (this.team1Score === this.team2Score) {
      alert('Scores cannot be tied. One team must win.');
      return;
    }

    try {
      this.tournament = await this.tournamentService.recordMatchResult(
        this.tournament.tournamentID,
        this.selectedMatch.match.matchID,
        this.team1Score,
        this.team2Score,
        false // Not played locally
      );
      this.closeResultDialog();
      this.selectedMatch = null;
    } catch (error: any) {
      console.error('Failed to record result:', error);
      alert(error.message || 'Failed to record result');
    }
  }

  // Get tournament winner
  getWinner(): string | null {
    if (!this.tournament) return null;
    return this.tournamentService.getTournamentWinner(this.tournament);
  }

  // Get status badge class
  getMatchStatusClass(matchDisplay: MatchDisplay): string {
    if (matchDisplay.isBye) return 'bye';
    if (matchDisplay.match.result) return 'completed';
    if (matchDisplay.isPlayable) return 'playable';
    return 'pending';
  }

  goBack() {
    this.router.navigate(['/tournaments']);
  }
}
