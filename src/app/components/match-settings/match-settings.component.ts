import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatchSettings, DEFAULT_MATCH_SETTINGS } from '../../models/match-settings.model';
import { MatchSettingsService } from '../../services/match-settings.service';

@Component({
  selector: 'app-match-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './match-settings.component.html',
  styleUrl: './match-settings.component.css'
})
export class MatchSettingsComponent implements OnInit {
  settings: MatchSettings = { ...DEFAULT_MATCH_SETTINGS };
  savedBanner = '';

  constructor(
    private matchSettingsService: MatchSettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.settings = { ...this.matchSettingsService.getSettings() };
  }

  onSave(): void {
    this.normalize();
    this.matchSettingsService.updateSettings({ ...this.settings });
    this.savedBanner = 'Settings saved.';
    setTimeout(() => {
      this.savedBanner = '';
    }, 2000);
  }

  onReset(): void {
    this.settings = { ...DEFAULT_MATCH_SETTINGS };
    this.matchSettingsService.resetToDefaults();
    this.savedBanner = 'Settings reset to defaults.';
    setTimeout(() => {
      this.savedBanner = '';
    }, 2000);
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }

  private normalize(): void {
    const clamp = (value: number, fallback: number, min = 0) => {
      const asNumber = Number(value);
      if (!Number.isFinite(asNumber)) {
        return fallback;
      }
      return Math.max(min, Math.floor(asNumber));
    };

    this.settings = {
      timeoutsPerTeam: clamp(this.settings.timeoutsPerTeam, DEFAULT_MATCH_SETTINGS.timeoutsPerTeam, 0),
      answerTimeSeconds: clamp(this.settings.answerTimeSeconds, DEFAULT_MATCH_SETTINGS.answerTimeSeconds, 1),
      speakWaitSeconds: clamp(this.settings.speakWaitSeconds, DEFAULT_MATCH_SETTINGS.speakWaitSeconds, 0),
      timeoutDurationSeconds: clamp(this.settings.timeoutDurationSeconds, DEFAULT_MATCH_SETTINGS.timeoutDurationSeconds, 1),
      appealsPerTeam: clamp(this.settings.appealsPerTeam, DEFAULT_MATCH_SETTINGS.appealsPerTeam, 0),
      appealDurationSeconds: clamp(this.settings.appealDurationSeconds, DEFAULT_MATCH_SETTINGS.appealDurationSeconds, 1),
      quizOutCorrect: clamp(this.settings.quizOutCorrect, DEFAULT_MATCH_SETTINGS.quizOutCorrect, 1),
      quizOutBonusPoints: clamp(this.settings.quizOutBonusPoints, DEFAULT_MATCH_SETTINGS.quizOutBonusPoints),
      errorOutMisses: clamp(this.settings.errorOutMisses, DEFAULT_MATCH_SETTINGS.errorOutMisses, 1),
      errorOutPenaltyPoints: clamp(this.settings.errorOutPenaltyPoints, DEFAULT_MATCH_SETTINGS.errorOutPenaltyPoints),
      foulsToFoulOut: clamp(this.settings.foulsToFoulOut, DEFAULT_MATCH_SETTINGS.foulsToFoulOut, 1),
      foulOutPenalty: clamp(this.settings.foulOutPenalty, DEFAULT_MATCH_SETTINGS.foulOutPenalty),
      bonusQuestionPoints: clamp(this.settings.bonusQuestionPoints, DEFAULT_MATCH_SETTINGS.bonusQuestionPoints)
    };
  }
}



