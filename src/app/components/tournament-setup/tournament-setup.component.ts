import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { TournamentService } from '../../services/tournament.service';
import { DatasetCatalogService } from '../../services/dataset-catalog.service';
import { DirectDataLoaderService } from '../../services/direct-data-loader.service';
import { DatasetInfo } from '../../models/dataset-info.model';
import { TournamentType, SeedingMethod, CreateTournamentInput } from '../../models/tournament.model';

interface ChapterInfo {
  chapter: number;
  setCount: number;
  sets: string[];
}

interface SetChapterMapping {
  setId: string;
  chapters: number[];  // All chapters this set contains questions from
}

@Component({
  selector: 'app-tournament-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tournament-setup.component.html',
  styleUrl: './tournament-setup.component.css'
})
export class TournamentSetupComponent implements OnInit {
  // Step tracking
  currentStep = 1;
  totalSteps = 4;

  // Step 1: Basic Info
  tournamentName = '';
  tournamentType: TournamentType = 'single-elimination';

  // Dataset selection
  datasets: DatasetInfo[] = [];
  selectedDatasetId: string | null = null;
  loadingDataset = false;

  // Step 2: Teams
  availableTeams: string[] = [];
  selectedTeams: string[] = [];
  seedingMethod: SeedingMethod = 'manual';

  // Step 3: Chapter Selection (replaces individual round question set selection)
  availableChapters: ChapterInfo[] = [];
  selectedChapters: number[] = [];

  // Generated question sets for rounds (computed from selected chapters)
  roundNames: string[] = [];
  questionSetsByRound: Map<number, string> = new Map();

  // Loading/Error
  loading = true;
  errorMessage = '';

  // Raw quiz set data for chapter extraction
  private setChapterMappings: SetChapterMapping[] = [];

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    private tournamentService: TournamentService,
    private datasetCatalog: DatasetCatalogService,
    private dataLoader: DirectDataLoaderService
  ) {}

  async ngOnInit() {
    await this.loadInitialData();
  }

  async loadInitialData() {
    this.loading = true;
    try {
      // Load datasets
      this.datasets = await this.datasetCatalog.getCatalog();
      this.selectedDatasetId = this.dataLoader.getActiveDatasetId() ?? this.datasets[0]?.id ?? null;

      // Load teams from database
      this.availableTeams = await this.dbService.getAllTeams();
      this.availableTeams.sort();

      // Load chapters from active dataset
      if (this.selectedDatasetId) {
        await this.loadChaptersFromDataset(this.selectedDatasetId);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.errorMessage = 'Failed to load data. Please try again.';
    }
    this.loading = false;
  }

  async loadChaptersFromDataset(datasetId: string) {
    this.loadingDataset = true;
    try {
      const dataset = this.datasets.find(ds => ds.id === datasetId);
      if (!dataset) return;

      const response = await fetch(dataset.path);
      if (!response.ok) throw new Error('Failed to load dataset');

      const data = await response.json();
      const quizSetEntries: any[] = data?.QuizSet ?? [];
      const questionDetails: any[] = data?.QuestionDetail ?? [];

      // Build a map of questionID -> chapter from QuestionDetail
      const questionChapterMap = new Map<number, number>();
      const allChapters = new Set<number>();
      for (const q of questionDetails) {
        const qid = Number(q.questionID || q.QuestionID || 0);
        const chapter = Number(q.qChapter || q.QChapter || q.chapter || 0);
        if (qid && chapter) {
          questionChapterMap.set(qid, chapter);
          allChapters.add(chapter);
        }
      }

      // Build map of setID -> questions in that set
      const setQuestionsMap = new Map<string, Set<number>>();
      for (const entry of quizSetEntries) {
        const setID = (entry.setID || entry.SetID || '').trim();
        const questNum = Number(entry.questNum || entry.QuestNum || 0);
        if (setID && questNum) {
          if (!setQuestionsMap.has(setID)) {
            setQuestionsMap.set(setID, new Set());
          }
          setQuestionsMap.get(setID)!.add(questNum);
        }
      }

      // Determine which chapters each set covers
      this.setChapterMappings = [];
      const chapterSets = new Map<number, Set<string>>();

      for (const [setID, questions] of setQuestionsMap) {
        const chaptersInSet = new Set<number>();
        for (const qid of questions) {
          const chapter = questionChapterMap.get(qid);
          if (chapter) {
            chaptersInSet.add(chapter);
          }
        }

        if (chaptersInSet.size > 0) {
          const chapters = Array.from(chaptersInSet).sort((a, b) => a - b);
          this.setChapterMappings.push({ setId: setID, chapters });

          // Add this set to each chapter it covers
          for (const chapter of chapters) {
            if (!chapterSets.has(chapter)) {
              chapterSets.set(chapter, new Set());
            }
            chapterSets.get(chapter)!.add(setID);
          }
        }
      }

      // Convert to ChapterInfo array
      this.availableChapters = Array.from(chapterSets.entries())
        .map(([chapter, sets]) => ({
          chapter,
          setCount: sets.size,
          sets: Array.from(sets).sort()
        }))
        .sort((a, b) => a.chapter - b.chapter);

    } catch (error) {
      console.error('Failed to load chapters:', error);
      this.availableChapters = [];
    }
    this.loadingDataset = false;
  }

  async onDatasetChange() {
    if (this.selectedDatasetId) {
      await this.loadChaptersFromDataset(this.selectedDatasetId);
      // Reset chapter selections when dataset changes
      this.selectedChapters = [];
      this.questionSetsByRound.clear();
    }
  }

  // Step Navigation
  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.tournamentName.trim().length > 0 && this.selectedDatasetId !== null;
      case 2:
        return this.selectedTeams.length >= 2;
      case 3:
        return this.selectedChapters.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  }

  nextStep() {
    if (this.canProceed() && this.currentStep < this.totalSteps) {
      this.currentStep++;

      // Generate question set assignments when entering step 4 (review)
      if (this.currentStep === 4) {
        this.generateQuestionSetAssignments();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Team Selection
  toggleTeam(team: string) {
    const index = this.selectedTeams.indexOf(team);
    if (index === -1) {
      this.selectedTeams.push(team);
    } else {
      this.selectedTeams.splice(index, 1);
    }
  }

  isTeamSelected(team: string): boolean {
    return this.selectedTeams.includes(team);
  }

  moveTeamUp(index: number) {
    if (index > 0) {
      [this.selectedTeams[index], this.selectedTeams[index - 1]] =
        [this.selectedTeams[index - 1], this.selectedTeams[index]];
    }
  }

  moveTeamDown(index: number) {
    if (index < this.selectedTeams.length - 1) {
      [this.selectedTeams[index], this.selectedTeams[index + 1]] =
        [this.selectedTeams[index + 1], this.selectedTeams[index]];
    }
  }

  removeTeam(index: number) {
    this.selectedTeams.splice(index, 1);
  }

  // Chapter Selection
  toggleChapter(chapter: number) {
    const index = this.selectedChapters.indexOf(chapter);
    if (index === -1) {
      this.selectedChapters.push(chapter);
      this.selectedChapters.sort((a, b) => a - b);
    } else {
      this.selectedChapters.splice(index, 1);
    }
  }

  isChapterSelected(chapter: number): boolean {
    return this.selectedChapters.includes(chapter);
  }

  getSelectedChapterSets(): string[] {
    // Find sets where ALL chapters the set covers are in the selected chapters
    // This ensures we only use sets that stay within the selected material
    const selectedChapterSet = new Set(this.selectedChapters);
    const matchingSets: string[] = [];

    for (const mapping of this.setChapterMappings) {
      // Check if all chapters in this set are selected
      const allChaptersSelected = mapping.chapters.every(ch => selectedChapterSet.has(ch));
      if (allChaptersSelected) {
        matchingSets.push(mapping.setId);
      }
    }

    return matchingSets.sort();
  }

  // Generate question set assignments for each round
  // Ensures no team sees the same set twice in a row
  generateQuestionSetAssignments() {
    this.roundNames = this.tournamentService.getRoundNames(
      this.selectedTeams.length,
      this.tournamentType
    );

    const availableSets = this.getSelectedChapterSets();
    this.questionSetsByRound.clear();

    if (availableSets.length === 0) return;

    // Shuffle the available sets for variety
    const shuffledSets = this.shuffleArray([...availableSets]);

    // Assign sets to rounds, cycling through and avoiding consecutive repeats
    let lastUsedSet = '';
    for (let i = 0; i < this.roundNames.length; i++) {
      let setIndex = i % shuffledSets.length;
      let selectedSet = shuffledSets[setIndex];

      // If same as last round and we have multiple sets, pick a different one
      if (selectedSet === lastUsedSet && shuffledSets.length > 1) {
        setIndex = (setIndex + 1) % shuffledSets.length;
        selectedSet = shuffledSets[setIndex];
      }

      this.questionSetsByRound.set(i + 1, selectedSet);
      lastUsedSet = selectedSet;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  getRoundQuestionSet(roundNumber: number): string {
    return this.questionSetsByRound.get(roundNumber) || '';
  }

  // Create Tournament
  async createTournament() {
    if (!this.canProceed()) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      const input: CreateTournamentInput = {
        name: this.tournamentName.trim(),
        type: this.tournamentType,
        teamNames: [...this.selectedTeams],
        seedingMethod: this.seedingMethod,
        questionSetsByRound: new Map(this.questionSetsByRound),
        datasetId: this.selectedDatasetId!
      };

      const tournament = await this.tournamentService.createTournament(input);
      this.router.navigate(['/tournament', tournament.tournamentID]);
    } catch (error) {
      console.error('Failed to create tournament:', error);
      this.errorMessage = 'Failed to create tournament. Please try again.';
      this.loading = false;
    }
  }

  goBack() {
    if (this.currentStep === 1) {
      this.router.navigate(['/tournaments']);
    } else {
      this.prevStep();
    }
  }

  // Get round 1 match count for display
  getRound1MatchCount(): number {
    const teamCount = this.selectedTeams.length;
    if (teamCount < 2) return 0;
    return Math.floor(teamCount / 2);
  }

  // Check if there's a bye in round 1 (odd team count)
  hasRound1Bye(): boolean {
    const teamCount = this.selectedTeams.length;
    return teamCount >= 2 && teamCount % 2 === 1;
  }

  getTotalSetsAvailable(): number {
    return this.getSelectedChapterSets().length;
  }

  formatSelectedChapters(): string {
    if (this.selectedChapters.length === 0) return '';
    if (this.selectedChapters.length === 1) return this.selectedChapters[0].toString();
    const sorted = [...this.selectedChapters].sort((a, b) => a - b);
    const last = sorted.pop();
    return sorted.join(', ') + ' & ' + last;
  }
}
