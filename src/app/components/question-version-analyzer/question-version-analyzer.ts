import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatabaseService } from '../../services/database.service';
import { QuestionDetail } from '../../models/player.model';
import { firstValueFrom } from 'rxjs';

interface DatasetInfo {
  id: string;
  book: string;
  version: string;
  questions: QuestionDetail[];
}

interface QuestionMatch {
  datasetId: string;
  book: string;
  version: string;
  confidence: number;
  matchReasons: string[];
}

interface QuestionAnalysis {
  questionID: number;
  currentBook: string;
  currentVersion: string;
  suggestedBook: string;
  suggestedVersion: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  questionText: string;
  chapter: number;
  verseRange: string;
  duplicateDatasets?: string[];
  allMatches?: QuestionMatch[];
  selected?: boolean;
}

@Component({
  selector: 'app-question-version-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-version-analyzer.html',
  styleUrl: './question-version-analyzer.css'
})
export class QuestionVersionAnalyzerComponent implements OnInit {
  analyses: QuestionAnalysis[] = [];
  isAnalyzing = false;
  isUpdating = false;
  isLoadingDatasets = false;
  showOnlyMissing = false;
  filterConfidence: 'all' | 'high' | 'medium' | 'low' | 'duplicates' = 'all';
  datasets: DatasetInfo[] = [];
  datasetsLoaded = 0;
  totalDatasets = 0;

  constructor(
    private dbService: DatabaseService,
    private router: Router,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.loadAllDatasets();
    await this.analyzeQuestions();
  }

  async loadAllDatasets(): Promise<void> {
    this.isLoadingDatasets = true;
    this.datasets = [];
    this.datasetsLoaded = 0;

    try {
      // Load catalog.json
      const catalog: any[] = await firstValueFrom(
        this.http.get<any[]>('/datasets/catalog.json')
      );

      this.totalDatasets = catalog.length;
      console.log(`Loading ${this.totalDatasets} datasets from catalog...`);

      // Load each dataset
      for (const datasetEntry of catalog) {
        try {
          const datasetData: any = await firstValueFrom(
            this.http.get<any>(datasetEntry.path)
          );

          // Parse questions from dataset
          const questions = this.parseDatasetQuestions(datasetData);

          this.datasets.push({
            id: datasetEntry.id,
            book: datasetEntry.book || 'Unknown',
            version: datasetEntry.version || 'Default',
            questions
          });

          this.datasetsLoaded++;
          console.log(`Loaded dataset ${datasetEntry.id}: ${questions.length} questions`);
        } catch (error) {
          console.error(`Error loading dataset ${datasetEntry.id}:`, error);
          this.datasetsLoaded++;
        }
      }

      console.log(`Successfully loaded ${this.datasets.length} datasets with ${this.datasets.reduce((sum, d) => sum + d.questions.length, 0)} total questions`);
    } catch (error) {
      console.error('Error loading catalog:', error);
      alert('Error loading dataset catalog. Check console for details.');
    } finally {
      this.isLoadingDatasets = false;
    }
  }

  parseDatasetQuestions(datasetData: any): QuestionDetail[] {
    const questions: QuestionDetail[] = [];
    const questionArray = datasetData.QuestionDetail || datasetData.questionDetail || [];

    for (const q of questionArray) {
      questions.push({
        questionID: parseInt(q.QuestionID || q.questionID || '0'),
        qdescription: q.QDescription || q.qdescription || '',
        qAnswer: q.QAnswer || q.qAnswer || '',
        qChapter: parseInt(q.QChapter || q.qChapter || '0'),
        qBegVerse: parseInt(q.QBegVerse || q.qBegVerse || '0'),
        qEndVerse: parseInt(q.QEndVerse || q.qEndVerse || '0'),
        qDescType: q.QDescType || q.qDescType || '',
        book: '',  // Will be set from dataset info during matching
        version: ''  // Will be set from dataset info during matching
      });
    }

    return questions;
  }

  normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  calculateTextSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);

    // Exact match
    if (norm1 === norm2) return 100;

    // Empty strings
    if (!norm1 || !norm2) return 0;

    // Contains relationship
    if (norm1.includes(norm2)) {
      return 70 + (norm2.length / norm1.length) * 25;
    }
    if (norm2.includes(norm1)) {
      return 70 + (norm1.length / norm2.length) * 25;
    }

    // Simple word overlap scoring
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    const commonWords = words1.filter(w => words2.includes(w));
    const overlapRatio = (commonWords.length * 2) / (words1.length + words2.length);

    return overlapRatio * 60;
  }

  findMatchingDatasets(question: QuestionDetail): QuestionMatch[] {
    const matches: QuestionMatch[] = [];

    for (const dataset of this.datasets) {
      for (const dsQuestion of dataset.questions) {
        // Chapter and verse must match
        if (dsQuestion.qChapter !== question.qChapter) continue;
        if (dsQuestion.qBegVerse !== question.qBegVerse) continue;
        if (dsQuestion.qEndVerse !== question.qEndVerse) continue;

        const matchReasons: string[] = [];
        let totalConfidence = 0;
        let criteriaCount = 0;

        // Chapter and verse match (40% weight)
        matchReasons.push('Chapter and verse match');
        totalConfidence += 40;
        criteriaCount++;

        // Description similarity (40% weight)
        const descSimilarity = this.calculateTextSimilarity(
          question.qdescription,
          dsQuestion.qdescription
        );
        if (descSimilarity > 50) {
          matchReasons.push(`Description similarity: ${Math.round(descSimilarity)}%`);
          totalConfidence += (descSimilarity / 100) * 40;
          criteriaCount++;
        }

        // Answer similarity (20% weight)
        const answerSimilarity = this.calculateTextSimilarity(
          question.qAnswer,
          dsQuestion.qAnswer
        );
        if (answerSimilarity > 50) {
          matchReasons.push(`Answer similarity: ${Math.round(answerSimilarity)}%`);
          totalConfidence += (answerSimilarity / 100) * 20;
          criteriaCount++;
        }

        // Must have at least description or answer match along with chapter/verse
        if (criteriaCount >= 2 && totalConfidence >= 60) {
          matches.push({
            datasetId: dataset.id,
            book: dataset.book,
            version: dataset.version,
            confidence: Math.round(totalConfidence),
            matchReasons
          });
        }
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
  }

  async analyzeQuestions() {
    this.isAnalyzing = true;
    this.analyses = [];

    try {
      const allQuestions = await this.dbService.getAllQuestions();

      console.log(`Total questions in database: ${allQuestions.length}`);
      console.log('Sample question:', allQuestions[0]);

      for (const question of allQuestions) {
        const analysis = this.analyzeQuestion(question);
        analysis.selected = false;  // Initialize selection state
        this.analyses.push(analysis);
      }

      console.log(`Analyzed ${this.analyses.length} questions`);

      // Group questions by their current book/version
      const bookVersionGroups = new Map<string, number>();
      allQuestions.forEach(q => {
        const key = `${q.book || 'NONE'}|${q.version || 'NONE'}`;
        bookVersionGroups.set(key, (bookVersionGroups.get(key) || 0) + 1);
      });
      console.log('Current book/version distribution:', Array.from(bookVersionGroups.entries()));

      // Group by suggested book/version
      const suggestedGroups = new Map<string, number>();
      this.analyses.forEach(a => {
        const key = `${a.suggestedBook}|${a.suggestedVersion}`;
        suggestedGroups.set(key, (suggestedGroups.get(key) || 0) + 1);
      });
      console.log('Suggested book/version distribution:', Array.from(suggestedGroups.entries()));

      // Report duplicates
      const duplicateCount = this.analyses.filter(a => a.duplicateDatasets && a.duplicateDatasets.length > 0).length;
      console.log(`Found ${duplicateCount} questions with duplicates across datasets`);
    } catch (error) {
      console.error('Error analyzing questions:', error);
      alert('Error analyzing questions. Check console for details.');
    } finally {
      this.isAnalyzing = false;
    }
  }

  analyzeQuestion(question: QuestionDetail): QuestionAnalysis {
    const verseRange = question.qEndVerse > question.qBegVerse
      ? `${question.qBegVerse}-${question.qEndVerse}`
      : `${question.qBegVerse}`;

    // Find matching datasets
    const matches = this.findMatchingDatasets(question);

    let suggestedBook = question.book || 'Unknown';
    let suggestedVersion = question.version || 'Default';
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let reasoning = '';
    let duplicateDatasets: string[] | undefined;

    if (matches.length > 0) {
      // Use the best match
      const bestMatch = matches[0];
      suggestedBook = bestMatch.book;
      suggestedVersion = bestMatch.version;

      // Determine confidence level
      if (bestMatch.confidence >= 90) {
        confidence = 'high';
      } else if (bestMatch.confidence >= 70) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      reasoning = bestMatch.matchReasons.join('; ');

      // Check for duplicates (multiple high-confidence matches)
      const highConfidenceMatches = matches.filter(m => m.confidence >= 70);
      if (highConfidenceMatches.length > 1) {
        duplicateDatasets = highConfidenceMatches.map(m => `${m.datasetId} (${m.book} - ${m.version})`);
        reasoning += ` | DUPLICATE in ${highConfidenceMatches.length} datasets`;
      }
    } else {
      reasoning = 'No matching dataset found';
    }

    return {
      questionID: question.questionID,
      currentBook: question.book || '',
      currentVersion: question.version || '',
      suggestedBook,
      suggestedVersion,
      confidence,
      reasoning,
      questionText: question.qdescription.substring(0, 100) + '...',
      chapter: question.qChapter,
      verseRange,
      duplicateDatasets,
      allMatches: matches
    };
  }

  get filteredAnalyses(): QuestionAnalysis[] {
    let filtered = this.analyses;

    // Apply confidence filter
    if (this.filterConfidence !== 'all') {
      if (this.filterConfidence === 'duplicates') {
        filtered = filtered.filter(a => a.duplicateDatasets && a.duplicateDatasets.length > 0);
      } else {
        filtered = filtered.filter(a => a.confidence === this.filterConfidence);
      }
    }

    // Apply show only missing filter
    if (this.showOnlyMissing) {
      filtered = filtered.filter(a =>
        !a.currentBook || !a.currentBook.trim() ||
        !a.currentVersion || !a.currentVersion.trim()
      );
    }

    return filtered;
  }

  get selectedCount(): number {
    return this.analyses.filter(a => a.selected).length;
  }

  selectByConfidence(confidenceLevel: 'high' | 'medium' | 'low') {
    this.analyses.forEach(a => {
      a.selected = a.confidence === confidenceLevel;
    });
  }

  selectAll(value: boolean) {
    this.filteredAnalyses.forEach(a => {
      a.selected = value;
    });
  }

  onSelectAllChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAll(checked);
  }

  async updateSelected() {
    const selectedAnalyses = this.analyses.filter(a => a.selected);

    if (selectedAnalyses.length === 0) {
      alert('No questions selected. Please select questions to update.');
      return;
    }

    // Show summary
    const bookVersionCounts = new Map<string, number>();
    selectedAnalyses.forEach(a => {
      const key = `${a.suggestedBook} - ${a.suggestedVersion}`;
      bookVersionCounts.set(key, (bookVersionCounts.get(key) || 0) + 1);
    });

    const summary = Array.from(bookVersionCounts.entries())
      .map(([key, count]) => `  ${key}: ${count} questions`)
      .join('\n');

    if (!confirm(`Update ${selectedAnalyses.length} selected questions?\n\nBreakdown by book/version:\n${summary}`)) {
      return;
    }

    this.isUpdating = true;
    let updated = 0;

    try {
      for (const analysis of selectedAnalyses) {
        const question = await this.dbService.getQuestion(analysis.questionID);
        if (question) {
          const updatedQuestion: QuestionDetail = {
            ...question,
            book: analysis.suggestedBook,
            version: analysis.suggestedVersion
          };
          await this.dbService.addQuestion(updatedQuestion);
          updated++;
        }
      }

      alert(`Successfully updated ${updated} questions!`);
      await this.analyzeQuestions(); // Refresh the list
    } catch (error) {
      console.error('Error updating questions:', error);
      alert('Error updating questions. Check console for details.');
    } finally {
      this.isUpdating = false;
    }
  }

  async updateQuestions() {
    // Select all for bulk update
    this.selectAll(true);
    await this.updateSelected();
  }

  onReturn() {
    this.router.navigate(['/']);
  }
}
