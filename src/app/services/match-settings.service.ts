import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DEFAULT_MATCH_SETTINGS, MatchSettings } from '../models/match-settings.model';

@Injectable({
  providedIn: 'root'
})
export class MatchSettingsService {
  private readonly storageKey = 'match-settings';
  private settingsSubject: BehaviorSubject<MatchSettings>;

  constructor() {
    const stored = this.readFromStorage();
    this.settingsSubject = new BehaviorSubject<MatchSettings>(stored ?? DEFAULT_MATCH_SETTINGS);
  }

  get settings$(): Observable<MatchSettings> {
    return this.settingsSubject.asObservable();
  }

  getSettings(): MatchSettings {
    return this.settingsSubject.value;
  }

  updateSettings(settings: MatchSettings): void {
    const normalized = this.normalize(settings);
    this.settingsSubject.next(normalized);
    this.writeToStorage(normalized);
  }

  resetToDefaults(): void {
    this.settingsSubject.next(DEFAULT_MATCH_SETTINGS);
    this.writeToStorage(DEFAULT_MATCH_SETTINGS);
  }

  private normalize(settings: MatchSettings): MatchSettings {
    return {
      timeoutsPerTeam: this.coercePositiveInt(settings.timeoutsPerTeam, DEFAULT_MATCH_SETTINGS.timeoutsPerTeam),
      answerTimeSeconds: this.coercePositiveInt(settings.answerTimeSeconds, DEFAULT_MATCH_SETTINGS.answerTimeSeconds),
      speakWaitSeconds: this.coercePositiveInt(settings.speakWaitSeconds, DEFAULT_MATCH_SETTINGS.speakWaitSeconds),
      timeoutDurationSeconds: this.coercePositiveInt(settings.timeoutDurationSeconds, DEFAULT_MATCH_SETTINGS.timeoutDurationSeconds),
      appealsPerTeam: this.coercePositiveInt(settings.appealsPerTeam, DEFAULT_MATCH_SETTINGS.appealsPerTeam),
      appealDurationSeconds: this.coercePositiveInt(settings.appealDurationSeconds, DEFAULT_MATCH_SETTINGS.appealDurationSeconds),
      quizOutCorrect: this.coercePositiveInt(settings.quizOutCorrect, DEFAULT_MATCH_SETTINGS.quizOutCorrect),
      quizOutBonusPoints: this.coerceInt(settings.quizOutBonusPoints, DEFAULT_MATCH_SETTINGS.quizOutBonusPoints),
      errorOutMisses: this.coercePositiveInt(settings.errorOutMisses, DEFAULT_MATCH_SETTINGS.errorOutMisses),
      errorOutPenaltyPoints: this.coerceInt(settings.errorOutPenaltyPoints, DEFAULT_MATCH_SETTINGS.errorOutPenaltyPoints),
      foulsToFoulOut: this.coercePositiveInt(settings.foulsToFoulOut, DEFAULT_MATCH_SETTINGS.foulsToFoulOut),
      foulOutPenalty: this.coerceInt(settings.foulOutPenalty, DEFAULT_MATCH_SETTINGS.foulOutPenalty),
      bonusQuestionPoints: this.coerceInt(settings.bonusQuestionPoints, DEFAULT_MATCH_SETTINGS.bonusQuestionPoints)
    };
  }

  private coercePositiveInt(value: number, fallback: number): number {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
    return normalized || fallback;
  }

  private coerceInt(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.floor(value);
  }

  private readFromStorage(): MatchSettings | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }
      return this.normalize(JSON.parse(stored));
    } catch (error) {
      console.warn('Unable to parse stored match settings:', error);
      return null;
    }
  }

  private writeToStorage(settings: MatchSettings): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(settings));
    } catch (error) {
      console.warn('Unable to persist match settings:', error);
    }
  }
}



