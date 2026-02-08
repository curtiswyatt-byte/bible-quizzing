import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MatchState, TeamRoster } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class QuizStateService {
  private storageKey = 'quiz-match-state';
  private matchStateSubject = new BehaviorSubject<MatchState | null>(null);
  public matchState$: Observable<MatchState | null> = this.matchStateSubject.asObservable();

  private team1DarkColor = '#80FF80';
  private team1LightColor = '#C0FFC0';
  private team2DarkColor = '#FFFF80';
  private team2LightColor = '#FFFFC0';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage.getItem(this.storageKey);
        if (stored) {
          const parsed: MatchState = JSON.parse(stored);
          this.matchStateSubject.next(parsed);
        }
      } catch (error) {
        console.warn('Unable to restore quiz match state from storage:', error);
      }
    }
  }

  getTeam1DarkColor(): string {
    return this.team1DarkColor;
  }

  getTeam1LightColor(): string {
    return this.team1LightColor;
  }

  getTeam2DarkColor(): string {
    return this.team2DarkColor;
  }

  getTeam2LightColor(): string {
    return this.team2LightColor;
  }

  setTeamColors(t1Dark: string, t1Light: string, t2Dark: string, t2Light: string): void {
    this.team1DarkColor = t1Dark;
    this.team1LightColor = t1Light;
    this.team2DarkColor = t2Dark;
    this.team2LightColor = t2Light;
  }

  getMatchState(): MatchState | null {
    return this.matchStateSubject.value;
  }

  setMatchState(state: MatchState): void {
    this.matchStateSubject.next(state);
    this.persistState(state);
  }

  updateScore(team: 1 | 2, points: number): void {
    const state = this.matchStateSubject.value;
    if (state) {
      if (team === 1) {
        state.team1Score += points;
      } else {
        state.team2Score += points;
      }
      this.matchStateSubject.next(state);
    }
  }

  updatePlayerStats(team: 1 | 2, rosterIndex: number, stat: keyof TeamRoster, value: number): void {
    const state = this.matchStateSubject.value;
    if (state) {
      const roster = team === 1 ? state.team1Roster : state.team2Roster;
      if (roster[rosterIndex]) {
        (roster[rosterIndex] as any)[stat] = value;
        this.matchStateSubject.next(state);
      }
    }
  }

  resetMatch(): void {
    this.matchStateSubject.next(null);
    this.clearPersistedState();
  }

  private persistState(state: MatchState | null): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (state) {
        window.sessionStorage.setItem(this.storageKey, JSON.stringify(state));
      } else {
        window.sessionStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.warn('Unable to persist quiz match state:', error);
    }
  }

  private clearPersistedState(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Unable to clear quiz match state:', error);
    }
  }
}



