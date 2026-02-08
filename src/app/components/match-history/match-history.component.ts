import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { MatchDetail, MatchSummary } from '../../models/player.model';

interface MatchStats {
  playerNumber: number;
  playerName: string;
  team: string;
  correct: number;
  errors: number;
  fouls: number;
  bonusCorrect: number;
  bonusErrors: number;
  totalPoints: number;
}

interface EnrichedMatchDetail {
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
  playerName: string;
  action: string;
  points: number;
  canceled: boolean;
  runningScore1: number;
  runningScore2: number;
}

@Component({
  selector: 'app-match-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './match-history.component.html',
  styleUrls: ['./match-history.component.css']
})
export class MatchHistoryComponent implements OnInit {
  matches: MatchSummary[] = [];
  selectedMatch: MatchSummary | null = null;
  matchDetails: EnrichedMatchDetail[] = [];
  matchStats: MatchStats[] = [];
  playerNameCache: Map<number, string> = new Map();

  // For filtering
  filterTeam: string = '';
  teams: string[] = [];

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadMatches();
  }

  async loadMatches() {
    try {
      const db = await this.dbService.getDatabase();
      const tx = db.transaction('matchSummary', 'readonly');
      const store = tx.objectStore('matchSummary');
      const request = store.getAll();

      request.onsuccess = () => {
        this.matches = (request.result || []).sort((a, b) => {
          // Sort by quizID then matchID (most recent first if they're timestamps)
          const aKey = `${a.quizID}-${a.matchID}`;
          const bKey = `${b.quizID}-${b.matchID}`;
          return bKey.localeCompare(aKey);
        });

        // Extract unique teams for filtering
        const teamSet = new Set<string>();
        this.matches.forEach(m => {
          if (m.team1) teamSet.add(m.team1);
          if (m.team2) teamSet.add(m.team2);
        });
        this.teams = Array.from(teamSet).sort();
      };
    } catch (e) {
      console.error('Failed to load matches:', e);
    }
  }

  getFilteredMatches(): MatchSummary[] {
    if (!this.filterTeam) {
      return this.matches;
    }
    return this.matches.filter(m =>
      m.team1 === this.filterTeam || m.team2 === this.filterTeam
    );
  }

  async selectMatch(match: MatchSummary) {
    this.selectedMatch = match;
    await this.loadMatchDetails(match.quizID, match.matchID);
    await this.loadMatchStats(match.quizID, match.matchID);
  }

  async loadMatchDetails(quizID: string, matchID: string) {
    try {
      const rawDetails = await this.dbService.getMatchDetails(quizID, matchID);
      // Sort by sequence number
      rawDetails.sort((a, b) => a.seqNum - b.seqNum);

      // Enrich with player names and running scores
      this.matchDetails = [];
      let runningScore1 = 0;
      let runningScore2 = 0;

      for (const detail of rawDetails) {
        // Get player name
        let playerName = this.playerNameCache.get(detail.actionPlayer);
        if (!playerName && detail.actionPlayer) {
          const player = await this.dbService.getPlayer(detail.actionPlayer);
          playerName = player?.nickname || player?.name || `Player #${detail.actionPlayer}`;
          this.playerNameCache.set(detail.actionPlayer, playerName);
        }

        // Calculate running score - determine which team the player is on
        const isTeam1Player = detail.tm1Player1 === detail.actionPlayer ||
                              detail.tm1Player2 === detail.actionPlayer ||
                              detail.tm1Player3 === detail.actionPlayer ||
                              detail.tm1Player4 === detail.actionPlayer;

        if (detail.action === 'Correct') {
          if (isTeam1Player) {
            runningScore1 += detail.points || 20;
          } else {
            runningScore2 += detail.points || 20;
          }
        }

        this.matchDetails.push({
          quizID: detail.quizID,
          matchID: detail.matchID,
          seqNum: detail.seqNum,
          questNum: detail.questNum,
          questType: detail.questType,
          questID: detail.questID,
          tm1Player1: detail.tm1Player1,
          tm1Player2: detail.tm1Player2,
          tm1Player3: detail.tm1Player3,
          tm1Player4: detail.tm1Player4,
          tm2Player1: detail.tm2Player1,
          tm2Player2: detail.tm2Player2,
          tm2Player3: detail.tm2Player3,
          tm2Player4: detail.tm2Player4,
          actionPlayer: detail.actionPlayer,
          playerName: playerName || '',
          action: detail.action,
          points: detail.points,
          canceled: detail.canceled,
          runningScore1,
          runningScore2
        });
      }
    } catch (e) {
      console.error('Failed to load match details:', e);
      this.matchDetails = [];
    }
  }

  async loadMatchStats(quizID: string, matchID: string) {
    try {
      const db = await this.dbService.getDatabase();
      const tx = db.transaction('matchStats', 'readonly');
      const store = tx.objectStore('matchStats');
      const index = store.index('by-quiz-match');
      const request = index.getAll([quizID, matchID]);

      request.onsuccess = async () => {
        const stats = request.result || [];

        // Enrich with player names
        this.matchStats = [];
        for (const stat of stats) {
          const player = await this.dbService.getPlayer(stat.playerNumber);
          const playerName = player?.nickname || player?.name || `Player #${stat.playerNumber}`;

          // Determine which team this player was on
          let team = 'Unknown';
          const detail = this.matchDetails.find(d =>
            d.tm1Player1 === stat.playerNumber ||
            d.tm1Player2 === stat.playerNumber ||
            d.tm1Player3 === stat.playerNumber ||
            d.tm1Player4 === stat.playerNumber
          );
          if (detail) {
            team = this.selectedMatch?.team1 || 'Team 1';
          } else {
            const detail2 = this.matchDetails.find(d =>
              d.tm2Player1 === stat.playerNumber ||
              d.tm2Player2 === stat.playerNumber ||
              d.tm2Player3 === stat.playerNumber ||
              d.tm2Player4 === stat.playerNumber
            );
            if (detail2) {
              team = this.selectedMatch?.team2 || 'Team 2';
            }
          }

          this.matchStats.push({
            playerNumber: stat.playerNumber,
            playerName,
            team,
            correct: stat.correct || 0,
            errors: stat.errors || 0,
            fouls: stat.fouls || 0,
            bonusCorrect: stat.bonusCorrect || 0,
            bonusErrors: stat.bonusErrors || 0,
            totalPoints: (stat.correct || 0) * 20 + (stat.bonusCorrect || 0) * 10
          });
        }

        // Sort by total points descending
        this.matchStats.sort((a, b) => b.totalPoints - a.totalPoints);
      };
    } catch (e) {
      console.error('Failed to load match stats:', e);
      this.matchStats = [];
    }
  }

  getActionClass(action: string): string {
    if (action === 'Correct') return 'action-correct';
    if (action === 'Wrong') return 'action-wrong';
    if (action === 'Foul') return 'action-foul';
    if (action.startsWith('Sub:')) return 'action-sub';
    if (action.startsWith('Swap:')) return 'action-swap';
    return '';
  }

  getQuestionTypeLabel(type: string): string {
    return type === 'B' ? 'Bonus' : 'Primary';
  }

  formatTimestamp(quizID: string): string {
    // If quizID is a timestamp, format it nicely
    const timestamp = parseInt(quizID, 10);
    if (!isNaN(timestamp) && timestamp > 1000000000000) {
      return new Date(timestamp).toLocaleString();
    }
    return quizID;
  }

  getWinner(match: MatchSummary): string {
    if (match.score1 > match.score2) return match.team1;
    if (match.score2 > match.score1) return match.team2;
    return 'Tie';
  }

  clearSelection() {
    this.selectedMatch = null;
    this.matchDetails = [];
    this.matchStats = [];
  }

  async deleteMatch(match: MatchSummary, event: Event) {
    event.stopPropagation();

    if (!confirm(`Delete match ${match.team1} vs ${match.team2}? This cannot be undone.`)) {
      return;
    }

    try {
      const db = await this.dbService.getDatabase();

      // Delete from matchSummary
      const tx1 = db.transaction('matchSummary', 'readwrite');
      const store1 = tx1.objectStore('matchSummary');
      store1.delete([match.quizID, match.matchID]);

      // Delete from matchDetail
      const tx2 = db.transaction('matchDetail', 'readwrite');
      const store2 = tx2.objectStore('matchDetail');
      const index = store2.index('by-quiz-match');
      const request = index.getAllKeys([match.quizID, match.matchID]);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => store2.delete(key));
      };

      // Delete from matchStats
      const tx3 = db.transaction('matchStats', 'readwrite');
      const store3 = tx3.objectStore('matchStats');
      const index3 = store3.index('by-quiz-match');
      const request3 = index3.getAllKeys([match.quizID, match.matchID]);

      request3.onsuccess = () => {
        const keys = request3.result;
        keys.forEach(key => store3.delete(key));
      };

      // Reload matches
      await this.loadMatches();
      this.clearSelection();
    } catch (e) {
      console.error('Failed to delete match:', e);
      alert('Failed to delete match.');
    }
  }

  exportMatchJSON() {
    if (!this.selectedMatch) return;

    const data = {
      summary: this.selectedMatch,
      details: this.matchDetails,
      stats: this.matchStats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-${this.selectedMatch.quizID}-${this.selectedMatch.matchID}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
