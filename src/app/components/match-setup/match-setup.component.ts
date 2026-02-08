import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { DatasetCatalogService } from '../../services/dataset-catalog.service';
import { DirectDataLoaderService } from '../../services/direct-data-loader.service';
import { DatabaseService } from '../../services/database.service';
import { MatchSettingsService } from '../../services/match-settings.service';
import { QuizStateService } from '../../services/quiz-state.service';
import { DatasetInfo } from '../../models/dataset-info.model';
import { MatchState, Player, QuestionDetail } from '../../models/player.model';
import { MatchSettings } from '../../models/match-settings.model';

@Component({
  selector: 'app-match-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './match-setup.component.html',
  styleUrl: './match-setup.component.css'
})
export class MatchSetupComponent implements OnInit {
  datasets: DatasetInfo[] = [];
  selectedDatasetId: string | null = null;
  loadingDataset = false;
  datasetMessage = '';

  matchName = '';
  quizSets: string[] = [];
  selectedSet = '';
  private questionSetMap = new Map<string, { questNum: number; bonusNum: number }[]>();
  private playerMap = new Map<number, Player>();
  private teamRosterMap = new Map<string, number[]>();
  private questionBank: QuestionDetail[] = [];
  private questionLookup = new Map<number, QuestionDetail>();
  private verseLookup = new Map<string, string>();
  private questionTypeLookup = new Map<string, { leadIn: string; class?: string }>();

  teams: string[] = [];
  selectedTeam1 = '';
  selectedTeam2 = '';

  team1Members: Player[] = [];
  team2Members: Player[] = [];
  team1Available: Player[] = [];
  team2Available: Player[] = [];
  team1Chairs: (Player | null)[] = [null, null, null, null];
  team2Chairs: (Player | null)[] = [null, null, null, null];
  matchSettings: MatchSettings;

  // Tournament context
  tournamentId: string | null = null;
  tournamentName: string | null = null;
  tournamentMatchId: string | null = null;
  isTournamentMatch = false;

  constructor(
    private route: ActivatedRoute,
    private datasetCatalog: DatasetCatalogService,
    private dataLoader: DirectDataLoaderService,
    private dbService: DatabaseService,
    private matchSettingsService: MatchSettingsService,
    private quizState: QuizStateService,
    private router: Router
  ) {
    this.matchSettings = this.matchSettingsService.getSettings();
  }

  async ngOnInit(): Promise<void> {
    this.datasets = await this.datasetCatalog.getCatalog();
    this.selectedDatasetId = this.dataLoader.getActiveDatasetId() ?? this.datasets[0]?.id ?? null;

    // Check for tournament context from query params
    this.route.queryParams.subscribe(params => {
      if (params['tournamentId'] && params['matchId']) {
        this.tournamentId = params['tournamentId'];
        this.tournamentName = params['tournamentName'] || null;
        this.tournamentMatchId = params['matchId'];
        this.isTournamentMatch = true;

        // Pre-fill from tournament context
        if (params['team1']) {
          this.selectedTeam1 = params['team1'];
        }
        if (params['team2']) {
          this.selectedTeam2 = params['team2'];
        }
        if (params['questionSetId']) {
          this.selectedSet = params['questionSetId'];
        }

        // Generate match name from tournament context
        this.matchName = `${params['matchId']}`;
      }
    });

    if (this.selectedDatasetId) {
      await this.activateDataset(this.selectedDatasetId, { suppressMessage: true });
    }

    this.matchSettingsService.settings$.subscribe(settings => {
      this.matchSettings = settings;
    });
  }

  async activateDataset(datasetId: string, options: { suppressMessage?: boolean } = {}): Promise<void> {
    if (this.loadingDataset || !datasetId) {
      return;
    }

    this.loadingDataset = true;
    this.datasetMessage = options.suppressMessage ? '' : 'Loading dataset...';

    // Avoid stale state from previous matches when switching datasets
    this.quizState.resetMatch();

    try {
      await this.dataLoader.loadDatasetById(datasetId);
      this.selectedDatasetId = datasetId;
      const datasetMeta = this.datasets.find(ds => ds.id === datasetId) || null;
      if (datasetMeta) {
        await this.loadDatasetCaches(datasetMeta);
      } else {
        this.questionSetMap.clear();
        this.playerMap.clear();
        this.teamRosterMap.clear();
      }
      if (!options.suppressMessage) {
        const dataset = this.datasets.find(ds => ds.id === datasetId);
        if (dataset) {
          this.datasetMessage = `${dataset.book} (${dataset.version}) loaded.`;
        }
      }
      await this.refreshData();
    } catch (error: any) {
      console.error('Failed to activate dataset:', error);
      this.datasetMessage = error?.message || 'Failed to activate dataset';
    } finally {
      this.loadingDataset = false;
    }
  }

  private async loadDatasetCaches(dataset: DatasetInfo): Promise<void> {
    try {
      const response = await fetch(dataset.path);
      if (!response.ok) {
        throw new Error(`Failed to load dataset definition (${response.status})`);
      }
      const data = await response.json();

      const quizSetEntries: any[] = data?.QuizSet ?? [];
      const map = new Map<string, { questNum: number; bonusNum: number }[]>();

      for (const entry of quizSetEntries) {
        const setID = (entry.setID || entry.SetID || '').trim();
        const questNum = parseInt(entry.questNum || entry.QuestNum || 0, 10);
        const bonusNum = parseInt(entry.bonusNum || entry.BonusNum || 0, 10);
        if (!setID || Number.isNaN(questNum)) {
          continue;
        }
        const list = map.get(setID) || [];
        list.push({ questNum, bonusNum });
        map.set(setID, list);
      }

      // Sort questions numerically inside each set for consistent play order
      for (const [key, list] of map.entries()) {
        list.sort((a, b) => a.questNum - b.questNum);
      }

      this.questionSetMap = map;
      this.quizSets = Array.from(map.keys()).sort();
      this.selectedSet = this.quizSets[0] ?? '';

      this.questionBank = [];
      this.questionLookup.clear();
      this.verseLookup.clear();
      this.questionTypeLookup.clear();
      const playersRaw: any[] = data?.Players ?? [];
      for (const raw of playersRaw) {
        const number = Number(raw.playerNumber || raw['Player Number'] || raw.PlayerNumber);
        if (!number || Number.isNaN(number)) {
          continue;
        }
        const player: Player = {
          playerNumber: number,
          name: (raw.name || raw.Name || '').trim(),
          nickname: (raw.nickname || raw.Nickname || '').trim(),
          ageGroup: (raw.ageGroup || raw['Age Group'] || '').trim(),
          team: (raw.team || raw.Team || '').trim()
        };
        this.playerMap.set(number, player);
      }

      const teamMap = new Map<string, Set<number>>();
      const teamsRaw: any[] = data?.Teams ?? [];
      if (Array.isArray(teamsRaw) && teamsRaw.length > 0) {
        for (const raw of teamsRaw) {
          const teamName = (raw.teamName || raw.TeamName || raw['Team Name'] || raw.team || '').trim();
          if (!teamName) {
            continue;
          }
          const set = teamMap.get(teamName) ?? new Set<number>();
          const numbers = Array.isArray(raw.playerNumbers) ? raw.playerNumbers : [raw.playerNumber, raw.PlayerNumber, raw['Player Number']];
          for (const value of numbers) {
            const num = Number(value);
            if (num && !Number.isNaN(num)) {
              set.add(num);
            }
          }
          teamMap.set(teamName, set);
        }
      }

      if (!teamMap.size && this.playerMap.size) {
        for (const player of this.playerMap.values()) {
          if (!player.team) {
            continue;
          }
          const set = teamMap.get(player.team) ?? new Set<number>();
          set.add(player.playerNumber);
          teamMap.set(player.team, set);
        }
      }

      this.teamRosterMap.clear();
      for (const [teamName, set] of teamMap.entries()) {
        this.teamRosterMap.set(teamName, Array.from(set.values()).sort((a, b) => a - b));
      }

      const questionBankRaw: any[] = data?.QuestionDetail ?? [];
      for (const raw of questionBankRaw) {
        const id = Number(raw.questionID || raw.QuestionID);
        if (!id || Number.isNaN(id)) {
          continue;
        }
        const question: QuestionDetail = {
          questionID: id,
          qdescription: (raw.qdescription || raw.QDescription || '').trim(),
          qAnswer: (raw.qAnswer || raw.QAnswer || '').trim(),
          qChapter: Number(raw.qChapter || raw.QChapter || 0),
          qBegVerse: Number(raw.qBegVerse || raw.QBegVerse || 0),
          qEndVerse: Number(raw.qEndVerse || raw.QEndVerse || 0),
          qDescType: (raw.qDescType || raw.QDescType || '').trim(),
          book: (raw.book || raw.Book || '').trim(),
          version: (raw.version || raw.Version || '').trim()
        };
        this.questionBank.push(question);
        this.questionLookup.set(id, question);
      }

      const versesRaw: any[] = data?.Verses ?? [];
      for (const raw of versesRaw) {
        const chapter = Number(raw.chapter || raw.Chapter || 0);
        const verse = Number(raw.verse || raw.Verse || 0);
        const text = (raw.text || raw.Text || '').trim();
        if (!Number.isNaN(chapter) && chapter > 0 && !Number.isNaN(verse) && verse > 0 && text) {
          this.verseLookup.set(`${chapter}:${verse}`, text);
        }
      }

      const typesRaw: any[] = data?.Types ?? [];
      for (const raw of typesRaw) {
        const id = (raw.typeID || raw.TypeID || raw['Type ID'] || '').trim();
        if (!id) {
          continue;
        }
        const leadIn = (raw.leadIn || raw.LeadIn || '').trim();
        const className = (raw.class || raw.Class || '').trim();
        this.questionTypeLookup.set(id, {
          leadIn,
          class: className || undefined
        });
      }

    } catch (error) {
      console.error('Unable to load question sets from dataset:', error);
      this.questionSetMap.clear();
      this.playerMap.clear();
      this.teamRosterMap.clear();
      this.questionBank = [];
      this.questionLookup.clear();
      this.verseLookup.clear();
      this.questionTypeLookup.clear();
      this.quizSets = [];
      this.selectedSet = '';
    }
  }

  private async refreshData(): Promise<void> {
    if (!this.questionSetMap.size) {
      this.quizSets = await this.dbService.getAllQuizSets();
      this.quizSets.sort();
    } else {
      this.quizSets = Array.from(this.questionSetMap.keys()).sort();
    }

    // Preserve tournament-selected set, otherwise default to first
    if (!this.isTournamentMatch || !this.quizSets.includes(this.selectedSet)) {
      this.selectedSet = this.quizSets[0] ?? '';
    }

    // Always load teams from database (not tied to dataset anymore)
    this.teams = await this.dbService.getAllTeams();
    this.teams.sort();

    // Preserve tournament-selected teams, otherwise default
    if (!this.isTournamentMatch) {
      this.selectedTeam1 = this.teams[0] ?? '';
      this.selectedTeam2 = this.teams[1] ?? '';
    }

    await this.loadTeamMembers();
  }

  async onDatasetChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    await this.activateDataset(select.value);
  }

  async loadTeamMembers(): Promise<void> {
    // Always load teams from database (not tied to dataset anymore)
    if (this.selectedTeam1) {
      const members = await this.getTeamPlayers(this.selectedTeam1);
      this.team1Members = members;
      this.team1Chairs = [null, null, null, null];
      for (let i = 0; i < Math.min(4, members.length); i++) {
        this.team1Chairs[i] = members[i];
      }
      this.team1Available = members.slice(Math.min(4, members.length));
    }

    if (this.selectedTeam2) {
      const members = await this.getTeamPlayers(this.selectedTeam2);
      this.team2Members = members;
      this.team2Chairs = [null, null, null, null];
      for (let i = 0; i < Math.min(4, members.length); i++) {
        this.team2Chairs[i] = members[i];
      }
      this.team2Available = members.slice(Math.min(4, members.length));
    }
  }

  private async getTeamPlayers(teamName: string): Promise<Player[]> {
    const numbers = await this.dbService.getTeamMembers(teamName);
    const players: Player[] = [];
    for (const num of numbers) {
      const player = await this.dbService.getPlayer(num);
      if (player) {
        players.push(player);
      }
    }
    return players;
  }

  onSelectPlayer(team: 1 | 2, player: Player, chairIndex: number): void {
    const chairs = team === 1 ? this.team1Chairs : this.team2Chairs;
    const available = team === 1 ? this.team1Available : this.team2Available;

    chairs[chairIndex] = player;
    const filtered = available.filter(p => p.playerNumber !== player.playerNumber);
    if (team === 1) {
      this.team1Available = filtered;
    } else {
      this.team2Available = filtered;
    }
  }

  onSelectPlayerFromList(team: 1 | 2, event: Event, chairIndex: number): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    const playerNumber = Number(select.value);
    if (!select.value || Number.isNaN(playerNumber)) {
      return;
    }

    const available = team === 1 ? this.team1Available : this.team2Available;
    const player = available.find(p => p.playerNumber === playerNumber);
    if (player) {
      this.onSelectPlayer(team, player, chairIndex);
    }
    select.selectedIndex = 0;
  }

  onRemoveChair(team: 1 | 2, chairIndex: number): void {
    const chairs = team === 1 ? this.team1Chairs : this.team2Chairs;
    const available = team === 1 ? this.team1Available : this.team2Available;
    const player = chairs[chairIndex];
    if (player) {
      chairs[chairIndex] = null;
      available.push(player);
      available.sort((a, b) => a.playerNumber - b.playerNumber);
    }
  }

  async onStartMatch(): Promise<void> {
    if (!this.selectedDatasetId) {
      alert('Please select a book/version.');
      return;
    }

    if (!this.matchName.trim()) {
      alert('Please enter a match name.');
      return;
    }

    if (!this.selectedSet) {
      alert('Please choose a question set.');
      return;
    }

    if (!this.selectedTeam1 || !this.selectedTeam2) {
      alert('Please select both teams.');
      return;
    }

    const filledTeam1 = this.team1Chairs.filter(ch => ch).length;
    const filledTeam2 = this.team2Chairs.filter(ch => ch).length;

    if (filledTeam1 === 0 || filledTeam2 === 0) {
      alert('Please assign at least one player to each team.');
      return;
    }

    const setItems = await this.dbService.getQuizSet(this.selectedSet);
    const questionQueueFromDb = setItems.map(item => ({ questNum: item.questNum, bonusNum: item.bonusNum }));
    const questionQueueFromCache = this.questionSetMap.get(this.selectedSet) ?? [];
    const questionQueue = questionQueueFromCache.length ? questionQueueFromCache : questionQueueFromDb;

    if (!questionQueue.length) {
      alert('The selected question set is empty.');
      return;
    }

    const questionIds = questionQueue.map(q => q.questNum);

    const userFile = await this.dbService.getUserFile();
    console.log('UserFile retrieved:', userFile);

    // Ensure we have valid IDs
    // For tournament matches, use the tournament name as the quizID for statistics grouping
    let quizID: string;
    if (this.isTournamentMatch && this.tournamentName) {
      quizID = this.tournamentName;
    } else {
      const quizIDPre = userFile?.quizIDPre || 'Quiz';
      const quizIDNum = userFile?.quizIDNum || '1';
      quizID = `${quizIDPre}${quizIDNum}`;
    }
    const matchID = this.matchName.trim();

    console.log(`Creating match with quizID: "${quizID}", matchID: "${matchID}"`);

    if (!matchID) {
      alert('Match name cannot be empty');
      return;
    }

    const settings = this.matchSettingsService.getSettings();

    const matchState: MatchState = {
      quizID,
      matchID,
      team1Team: this.selectedTeam1,
      team2Team: this.selectedTeam2,
      team1Score: 0,
      team2Score: 0,
      team1Fouls: 0,
      team1Errors: 0,
      team1TOs: settings.timeoutsPerTeam,
      team1Appeals: settings.appealsPerTeam,
      team2Fouls: 0,
      team2Errors: 0,
      team2TOs: settings.timeoutsPerTeam,
      team2Appeals: settings.appealsPerTeam,
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
        bonusOnly: false
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
        bonusOnly: false
      })),
      setID: this.selectedSet,
      currentQuestionID: null,
      bonusQuestion: false,
      finishQuest: false,
      questionIds,
      totalQuestions: questionIds.length,
      questionQueue,
      questionHistory: [],
      questionBank: this.questionBank.length ? [...this.questionBank] : undefined,
      questionLookupEntries: this.questionLookup.size ? Array.from(this.questionLookup.entries()) : undefined,
      verseLookupEntries: this.verseLookup.size ? Array.from(this.verseLookup.entries()) : undefined,
      questionTypeEntries: this.questionTypeLookup.size
        ? Array.from(this.questionTypeLookup.entries()).map(([key, value]) => [key, { ...value }])
        : undefined,
      matchSettings: { ...settings },
      pendingBonusTeam: null,
      pendingBonusSeat: null
    };

    // Store tournament context in sessionStorage if this is a tournament match
    if (this.isTournamentMatch && this.tournamentId && this.tournamentMatchId) {
      sessionStorage.setItem('tournamentContext', JSON.stringify({
        tournamentId: this.tournamentId,
        matchId: this.tournamentMatchId
      }));
    }

    this.quizState.setMatchState(matchState);
    this.router.navigate(['/quiz-session']);
  }

  onCancel(): void {
    // If tournament match, go back to tournament bracket
    if (this.isTournamentMatch && this.tournamentId) {
      this.router.navigate(['/tournament', this.tournamentId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}
