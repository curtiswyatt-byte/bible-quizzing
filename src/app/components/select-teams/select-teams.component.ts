import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuizStateService } from '../../services/quiz-state.service';
import { Player, MatchState, TeamRoster, TeamChair } from '../../models/player.model';
import { MatchSettings } from '../../models/match-settings.model';
import { MatchSettingsService } from '../../services/match-settings.service';

@Component({
  selector: 'app-select-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './select-teams.component.html',
  styleUrl: './select-teams.component.css'
})
export class SelectTeamsComponent implements OnInit {
  teams: string[] = [];
  team1Players: Player[] = [];
  team2Players: Player[] = [];
  
  selectedTeam1: string = '';
  selectedTeam2: string = '';
  
  team1Members: Player[] = [];
  team2Members: Player[] = [];
  
  team1Chairs: (Player | null)[] = [null, null, null, null];
  team2Chairs: (Player | null)[] = [null, null, null, null];

  constructor(
    private dbService: DatabaseService,
    private quizState: QuizStateService,
    private router: Router,
    private matchSettingsService: MatchSettingsService
  ) {}

  async ngOnInit() {
    await this.loadTeams();
    const state = this.quizState.getMatchState();
    if (state) {
      this.selectedTeam1 = state.team1Team;
      this.selectedTeam2 = state.team2Team;
      if (this.selectedTeam1) await this.loadTeam1Members();
      if (this.selectedTeam2) await this.loadTeam2Members();
    }
  }

  async loadTeams() {
    this.teams = await this.dbService.getAllTeams();
    this.teams.sort();
  }

  async loadTeam1Members() {
    if (!this.selectedTeam1) return;
    const memberNumbers = await this.dbService.getTeamMembers(this.selectedTeam1);
    this.team1Members = [];
    for (const num of memberNumbers) {
      const player = await this.dbService.getPlayer(num);
      if (player) {
        this.team1Members.push(player);
      }
    }
    this.team1Players = [...this.team1Members];
  }

  async loadTeam2Members() {
    if (!this.selectedTeam2) return;
    const memberNumbers = await this.dbService.getTeamMembers(this.selectedTeam2);
    this.team2Members = [];
    for (const num of memberNumbers) {
      const player = await this.dbService.getPlayer(num);
      if (player) {
        this.team2Members.push(player);
      }
    }
    this.team2Players = [...this.team2Members];
  }

  async onTeam1Select() {
    await this.loadTeam1Members();
    this.team1Chairs = [null, null, null, null];
  }

  async onTeam2Select() {
    await this.loadTeam2Members();
    this.team2Chairs = [null, null, null, null];
  }

  onTeam1PlayerClick(player: Player, chairIndex: number) {
    // Remove from available list
    this.team1Players = this.team1Players.filter(p => p.playerNumber !== player.playerNumber);
    // Add to chair
    this.team1Chairs[chairIndex] = player;
  }

  onTeam2PlayerClick(player: Player, chairIndex: number) {
    // Remove from available list
    this.team2Players = this.team2Players.filter(p => p.playerNumber !== player.playerNumber);
    // Add to chair
    this.team2Chairs[chairIndex] = player;
  }

  onRemoveTeam1Chair(chairIndex: number) {
    const player = this.team1Chairs[chairIndex];
    if (player) {
      this.team1Players.push(player);
      this.team1Chairs[chairIndex] = null;
    }
  }

  onRemoveTeam2Chair(chairIndex: number) {
    const player = this.team2Chairs[chairIndex];
    if (player) {
      this.team2Players.push(player);
      this.team2Chairs[chairIndex] = null;
    }
  }

  getNextEmptyChair(team: 1 | 2): number {
    const chairs = team === 1 ? this.team1Chairs : this.team2Chairs;
    for (let i = 0; i < chairs.length; i++) {
      if (chairs[i] === null) return i;
    }
    return 0; // Replace first chair if all full
  }

  async onAccept() {
    if (!this.selectedTeam1 || !this.selectedTeam2) {
      alert('Please select both teams');
      return;
    }

    if (this.team1Chairs.filter(c => c !== null).length === 0 || 
        this.team2Chairs.filter(c => c !== null).length === 0) {
      alert('Please select at least one player for each team');
      return;
    }

    // Initialize match state
    const state = this.quizState.getMatchState();
    if (!state || !state.setID) {
      alert('Please select a question set before choosing teams.');
      this.router.navigate(['/select-question']);
      return;
    }

    const userFile = await this.dbService.getUserFile();
    const quizID = userFile ? `${userFile.quizIDPre}${userFile.quizIDNum}` : state.quizID || 'QUIZ1';

    const settings: MatchSettings = state.matchSettings ?? this.matchSettingsService.getSettings();

    const matchState: MatchState = {
      ...state,
      quizID,
      matchID: state.matchID || 'MATCH1',
      team1Team: this.selectedTeam1,
      team2Team: this.selectedTeam2,
      team1Score: 0,
      team2Score: 0,
      team1Fouls: 0,
      team1Errors: 0,
      team1TOs: settings.timeoutsPerTeam,
      team2Fouls: 0,
      team2Errors: 0,
      team2TOs: settings.timeoutsPerTeam,
      questionNum: 0,
      tieBreakNum: 0,
      team1Chairs: this.team1Chairs.map((p, i) => ({
        playerNumber: p?.playerNumber || 0,
        rosterPosition: i,
        name: p ? (p.nickname || p.name) : '',
        quizOut: false,
        errorOut: false,
        bonusOnly: false
      })),
      team2Chairs: this.team2Chairs.map((p, i) => ({
        playerNumber: p?.playerNumber || 0,
        rosterPosition: i,
        name: p ? (p.nickname || p.name) : '',
        quizOut: false,
        errorOut: false,
        bonusOnly: false
      })),
      team1Roster: this.team1Members.map(p => ({
        playerNumber: p.playerNumber,
        activeQuestions: 0,
        correct: 0,
        errors: 0,
        fouls: 0,
        bonusCorrect: 0,
        bonusErrors: 0,
        quizOut: false,
        errorOut: false,
        bonusOnly: false,
        name: p.name,
        nickname: p.nickname
      })),
      team2Roster: this.team2Members.map(p => ({
        playerNumber: p.playerNumber,
        activeQuestions: 0,
        correct: 0,
        errors: 0,
        fouls: 0,
        bonusCorrect: 0,
        bonusErrors: 0,
        quizOut: false,
        errorOut: false,
        bonusOnly: false,
        name: p.name,
        nickname: p.nickname
      })),
      currentQuestionID: null,
      bonusQuestion: false,
      finishQuest: false,
      questionIds: state.questionIds ? [...state.questionIds] : [],
      totalQuestions: state.totalQuestions,
      questionQueue: state.questionQueue ? state.questionQueue.map((q) => ({ ...q })) : [],
      questionHistory: [],
      matchSettings: settings,
      pendingBonusTeam: null,
      pendingBonusSeat: null
    };

    this.quizState.setMatchState(matchState);
    this.router.navigate(['/quiz-session']);
  }

  onCancel() {
    this.router.navigate(['/']);
  }
}

