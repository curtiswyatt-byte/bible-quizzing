import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuizStateService } from '../../services/quiz-state.service';
import { MatchState } from '../../models/player.model';
import { MatchSettingsService } from '../../services/match-settings.service';

@Component({
  selector: 'app-select-question',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './select-question.component.html',
  styleUrl: './select-question.component.css'
})
export class SelectQuestionComponent implements OnInit {
  quizSets: string[] = [];
  selectedSet: string = '';
  matchID: string = '';
  questArr: { questNum: number; bonusNum: number }[] = [];

  constructor(
    private dbService: DatabaseService,
    private quizState: QuizStateService,
    private router: Router,
    private matchSettingsService: MatchSettingsService
  ) {}

  async ngOnInit() {
    await this.loadQuizSets();
  }

  async loadQuizSets() {
    try {
      this.quizSets = await this.dbService.getAllQuizSets();
      this.quizSets.sort();
      console.log(`Loaded ${this.quizSets.length} quiz sets:`, this.quizSets);
      if (this.quizSets.length === 0) {
        alert('No quiz sets found. Please import data that includes quiz sets.');
      }
    } catch (error) {
      console.error('Error loading quiz sets:', error);
      alert('Error loading quiz sets. Please check the console.');
    }
  }

  async onSetSelect() {
    if (!this.selectedSet) {
      this.questArr = [];
      return;
    }

    try {
      const setItems = await this.dbService.getQuizSet(this.selectedSet);
      console.log(`Found ${setItems.length} items in set ${this.selectedSet}`);
      this.questArr = setItems.map(item => ({
        questNum: item.questNum,
        bonusNum: item.bonusNum
      }));
      
      if (this.questArr.length === 0) {
        alert(`No questions found in set "${this.selectedSet}". The quiz set may not have been imported correctly.`);
      }
    } catch (error) {
      console.error('Error loading quiz set:', error);
      alert(`Error loading quiz set: ${error}`);
    }
  }

  async onAccept() {
    if (!this.matchID.trim()) {
      alert('A match name is required to begin the match.');
      return;
    }

    if (!this.selectedSet) {
      alert('A question set must be selected for a match to begin.');
      return;
    }

    if (this.questArr.length === 0) {
      alert(`No questions found in set "${this.selectedSet}". Please choose another set or reimport your data.`);
      return;
    }

    // Store in quiz state service
    const questionIds = this.questArr.map(q => q.questNum);
    const totalQuestions = questionIds.length;
    const questionQueue = this.questArr.map(q => ({ ...q }));

    const existingState = this.quizState.getMatchState();
    const settings = existingState?.matchSettings ?? this.matchSettingsService.getSettings();
    if (existingState) {
      const updatedState: MatchState = {
        ...existingState,
        setID: this.selectedSet,
        matchID: this.matchID.trim(),
        questionIds,
        totalQuestions,
        questionQueue,
        questionHistory: [],
        matchSettings: settings
      };
      this.quizState.setMatchState(updatedState);
    } else {
      const newState: MatchState = {
        quizID: '',
        matchID: this.matchID.trim(),
        team1Team: '',
        team2Team: '',
        team1Score: 0,
        team2Score: 0,
        team1Fouls: 0,
        team1Errors: 0,
        team1TOs: 0,
        team1Appeals: settings.appealsPerTeam,
        team2Fouls: 0,
        team2Errors: 0,
        team2TOs: 0,
        team2Appeals: settings.appealsPerTeam,
        questionNum: 0,
        tieBreakNum: 0,
        team1Chairs: [],
        team2Chairs: [],
        team1Roster: [],
        team2Roster: [],
        setID: this.selectedSet,
        currentQuestionID: null,
        bonusQuestion: false,
        finishQuest: false,
        questionIds,
        totalQuestions,
        questionQueue,
        questionHistory: [],
        matchSettings: settings,
        pendingBonusTeam: null,
        pendingBonusSeat: null
      };
      this.quizState.setMatchState(newState);
    }

    // Navigate to select teams
    this.router.navigate(['/select-teams']);
  }

  onCancel() {
    this.router.navigate(['/']);
  }
}

