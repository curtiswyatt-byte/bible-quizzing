import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { MatchSummary, MatchStats, Player, Parms } from '../../models/player.model';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.css'
})
export class StatisticsComponent implements OnInit {
  tournaments: string[] = [];
  teams: string[] = [];
  players: Player[] = [];
  filteredTeams: string[] = [];
  filteredPlayers: Player[] = [];

  selectedTournament: string = '';
  selectedTeam: string = '';
  selectedPlayer: Player | null = null;
  statType: 'team' | 'player' = 'team';

  displayText: string = '';
  stats: any[] = [];

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTournaments();
    await this.loadTeams();
    await this.loadPlayers();
  }

  async loadTournaments() {
    // Get unique quiz IDs from match summaries
    const summaries = await this.getAllMatchSummaries();
    const quizIDs = new Set<string>();
    summaries.forEach(s => quizIDs.add(s.quizID));
    this.tournaments = Array.from(quizIDs).sort();
  }

  async getAllMatchSummaries(): Promise<MatchSummary[]> {
    return await this.dbService.getAllMatchSummaries();
  }

  async loadTeams() {
    this.teams = await this.dbService.getAllTeams();
    this.teams.sort();
  }

  async loadPlayers() {
    this.players = await this.dbService.getAllPlayers();
    this.players.sort((a, b) => a.name.localeCompare(b.name));
  }

  async onTournamentSelect() {
    // Reset selections when tournament changes
    this.selectedTeam = '';
    this.selectedPlayer = null;
    this.displayText = '';

    if (this.selectedTournament) {
      await this.filterTeamsAndPlayers();
    } else {
      this.filteredTeams = [];
      this.filteredPlayers = [];
    }
  }

  async filterTeamsAndPlayers() {
    if (!this.selectedTournament) {
      this.filteredTeams = [];
      this.filteredPlayers = [];
      return;
    }

    // Get all match stats for this tournament
    const tournamentStats = await this.dbService.getAllMatchStatsForTournament(this.selectedTournament);

    // Get unique player numbers that have stats
    const playerNumbersWithStats = new Set<number>();
    tournamentStats.forEach(stat => {
      playerNumbersWithStats.add(stat.playerNumber);
    });

    // Filter players to only those with stats in this tournament
    this.filteredPlayers = this.players.filter(p =>
      playerNumbersWithStats.has(p.playerNumber)
    );

    // Get teams that have players with stats in this tournament
    const teamsWithStats = new Set<string>();
    for (const playerNum of playerNumbersWithStats) {
      const player = await this.dbService.getPlayer(playerNum);
      if (player && player.team) {
        teamsWithStats.add(player.team);
      }
    }

    this.filteredTeams = Array.from(teamsWithStats).sort();
  }

  async onTeamSelect() {
    if (this.selectedTeam && this.selectedTournament) {
      await this.loadTeamStats();
    }
  }

  async onPlayerSelect() {
    if (this.selectedPlayer && this.selectedTournament) {
      await this.loadPlayerStats();
    }
  }

  async loadStats() {
    if (this.statType === 'team') {
      await this.loadTeamStats();
    } else {
      await this.loadPlayerStats();
    }
  }

  async loadTeamStats() {
    if (!this.selectedTeam || !this.selectedTournament) return;

    // Get all matches for this tournament and team
    this.displayText = `Team Statistics for ${this.selectedTeam}\n`;
    this.displayText += `Tournament: ${this.selectedTournament}\n\n`;
    this.displayText += `#    Name                           Act. Cor Err Foul  %    Cor Err   %   Quiz Err\n`;
    this.displayText += `                                            Primary           Bonus          Out\n`;

    // Get team members
    const memberNumbers = await this.dbService.getTeamMembers(this.selectedTeam);
    for (const playerNum of memberNumbers) {
      const player = await this.dbService.getPlayer(playerNum);
      if (player) {
        // Get stats for this player in this tournament
        const stats = await this.getPlayerTournamentStats(playerNum, this.selectedTournament);
        this.displayText += this.formatPlayerStats(player, stats);
      }
    }
  }

  async loadPlayerStats() {
    if (!this.selectedPlayer || !this.selectedTournament) return;

    const stats = await this.getPlayerTournamentStats(this.selectedPlayer.playerNumber, this.selectedTournament);
    this.displayText = `Player Statistics for ${this.selectedPlayer.name}\n`;
    this.displayText += `Tournament: ${this.selectedTournament}\n\n`;
    this.displayText += this.formatPlayerStats(this.selectedPlayer, stats);
  }

  async getPlayerTournamentStats(playerNumber: number, quizID: string): Promise<any> {
    // Get all match stats for this player in this tournament
    const allStats = await this.dbService.getAllMatchStatsForTournament(quizID);
    const playerStats = allStats.filter(s => s.playerNumber === playerNumber);
    
    const aggregated = {
      activeQuestions: 0,
      correct: 0,
      errors: 0,
      fouls: 0,
      bonusCorrect: 0,
      bonusErrors: 0,
      quizOut: 0,
      errOut: 0
    };

    playerStats.forEach(stat => {
      aggregated.activeQuestions += stat.activeQuestions;
      aggregated.correct += stat.correct;
      aggregated.errors += stat.errors;
      aggregated.fouls += stat.fouls;
      aggregated.bonusCorrect += stat.bonusCorrect;
      aggregated.bonusErrors += stat.bonusErrors;
    });

    // Get parms for quiz out numbers
    const userFile = await this.dbService.getUserFile();
    if (userFile) {
      const parms = await this.dbService.getParms(userFile.book);
      if (parms) {
        // Calculate quiz outs and error outs based on parms
        aggregated.quizOut = Math.floor(aggregated.correct / parms.quizOutNum);
        aggregated.errOut = aggregated.errors >= parms.errOutNum ? 1 : 0;
      }
    }

    return aggregated;
  }

  formatPlayerStats(player: Player, stats: any): string {
    const pct = stats.activeQuestions > 0 
      ? Math.round((stats.correct / stats.activeQuestions) * 100) 
      : 0;
    const bonusPct = (stats.bonusCorrect + stats.bonusErrors) > 0
      ? Math.round((stats.bonusCorrect / (stats.bonusCorrect + stats.bonusErrors)) * 100)
      : 0;

    return `${player.playerNumber.toString().padStart(3)} ${player.name.padEnd(30)} ${stats.activeQuestions.toString().padStart(4)} ${stats.correct.toString().padStart(3)} ${stats.errors.toString().padStart(3)} ${stats.fouls.toString().padStart(3)} ${pct.toString().padStart(3)}% ${stats.bonusCorrect.toString().padStart(3)} ${stats.bonusErrors.toString().padStart(3)} ${bonusPct.toString().padStart(3)}% ${stats.quizOut.toString().padStart(2)} ${stats.errOut.toString().padStart(2)}\n`;
  }

  onClear() {
    this.displayText = '';
    this.selectedTeam = '';
    this.selectedPlayer = null;
  }

  onPrint() {
    window.print();
  }

  onReturn() {
    this.router.navigate(['/']);
  }
}

