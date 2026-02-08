import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuizSet, QuestionDetail } from '../../models/player.model';

interface QuizSetSummary {
  setID: string;
  questionCount: number;
  bonusCount: number;
  questions: Array<{ questNum: number; bonusNum: number; questionID: number; description: string }>;
}

@Component({
  selector: 'app-quiz-sets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-sets.html',
  styleUrl: './quiz-sets.css'
})
export class QuizSetsComponent implements OnInit {
  quizSets: QuizSetSummary[] = [];
  filteredQuizSets: QuizSetSummary[] = [];
  selectedSet: QuizSetSummary | null = null;

  // Filters
  availableBooks: string[] = [];
  availableVersions: string[] = [];
  selectedBook: string = '';
  selectedVersion: string = '';

  // For creating/editing sets
  showEditor = false;
  editorMode: 'create' | 'edit' = 'create';
  setID: string = '';
  availableQuestions: QuestionDetail[] = [];
  selectedQuestions: Array<{ questionID: number; isBonus: boolean; description: string }> = [];
  newQuestionID: number | null = null;

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadQuizSets();
    await this.loadAvailableQuestions();
    await this.loadFilters();
  }

  async loadQuizSets() {
    const setIDs = await this.dbService.getAllQuizSets();
    this.quizSets = [];

    for (const setID of setIDs) {
      const items = await this.dbService.getQuizSet(setID);
      const questions: Array<{ questNum: number; bonusNum: number; questionID: number; description: string }> = [];

      let questionCount = 0;
      let bonusCount = 0;

      for (const item of items) {
        const question = await this.dbService.getQuestion(item.questNum);
        const questionDesc = question ? `Q${item.questNum}: ${question.qdescription.substring(0, 50)}...` : `Q${item.questNum}`;

        questions.push({
          questNum: item.questNum,
          bonusNum: item.bonusNum,
          questionID: item.questNum,
          description: questionDesc
        });

        questionCount++;
        if (item.bonusNum > 0) {
          bonusCount++;
        }
      }

      this.quizSets.push({
        setID,
        questionCount,
        bonusCount,
        questions
      });
    }

    this.quizSets.sort((a, b) => a.setID.localeCompare(b.setID));
    this.applyFilters();
  }

  async loadAvailableQuestions() {
    this.availableQuestions = await this.dbService.getAllQuestions();
    this.availableQuestions.sort((a, b) => a.questionID - b.questionID);
  }

  async loadFilters() {
    const allQuestions = await this.dbService.getAllQuestions();

    // Get unique books and versions
    const books = new Set<string>();
    const versions = new Set<string>();

    allQuestions.forEach(q => {
      if (q.book && q.book.trim()) books.add(q.book.trim());
      if (q.version && q.version.trim()) versions.add(q.version.trim());
    });

    this.availableBooks = Array.from(books).sort();
    this.availableVersions = Array.from(versions).sort();

    // Log if questions are missing book/version
    const questionsWithoutBookVersion = allQuestions.filter(q => !q.book || !q.version);
    if (questionsWithoutBookVersion.length > 0) {
      console.log(`⚠️ Found ${questionsWithoutBookVersion.length} questions without book/version data`);
      console.log('Use the Data Import page to analyze and set book/version for existing questions');
    }
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    this.filteredQuizSets = this.quizSets.filter(set => {
      // If no filters selected, show all
      if (!this.selectedBook && !this.selectedVersion) {
        return true;
      }

      // Check if any question in the set matches the filters
      return set.questions.some(q => {
        const questionMatches = this.availableQuestions.find(aq => aq.questionID === q.questionID);
        if (!questionMatches) return false;

        const bookMatch = !this.selectedBook || questionMatches.book === this.selectedBook;
        const versionMatch = !this.selectedVersion || questionMatches.version === this.selectedVersion;

        return bookMatch && versionMatch;
      });
    });
  }

  selectSet(set: QuizSetSummary) {
    this.selectedSet = set;
  }

  openCreateEditor() {
    this.editorMode = 'create';
    this.showEditor = true;
    this.setID = '';
    this.selectedQuestions = [];
    this.newQuestionID = null;
  }

  openEditEditor(set: QuizSetSummary) {
    this.editorMode = 'edit';
    this.showEditor = true;
    this.setID = set.setID;
    this.selectedQuestions = set.questions.map(q => ({
      questionID: q.questionID,
      isBonus: q.bonusNum > 0,
      description: q.description
    }));
    this.selectedSet = set;
    this.newQuestionID = null;
  }

  closeEditor() {
    this.showEditor = false;
    this.setID = '';
    this.selectedQuestions = [];
    this.newQuestionID = null;
  }

  addQuestionToSet() {
    if (!this.newQuestionID) return;

    const question = this.availableQuestions.find(q => q.questionID === this.newQuestionID);
    if (!question) {
      alert('Question not found');
      return;
    }

    const alreadyAdded = this.selectedQuestions.find(q => q.questionID === this.newQuestionID);
    if (alreadyAdded) {
      alert('This question is already in the set');
      return;
    }

    this.selectedQuestions.push({
      questionID: this.newQuestionID,
      isBonus: false,
      description: `Q${this.newQuestionID}: ${question.qdescription.substring(0, 50)}...`
    });

    this.newQuestionID = null;
  }

  removeQuestion(questionID: number) {
    this.selectedQuestions = this.selectedQuestions.filter(q => q.questionID !== questionID);
  }

  toggleBonus(questionID: number) {
    const question = this.selectedQuestions.find(q => q.questionID === questionID);
    if (question) {
      question.isBonus = !question.isBonus;
    }
  }

  async saveSet() {
    if (!this.setID.trim()) {
      alert('Please enter a Set ID');
      return;
    }

    if (this.selectedQuestions.length === 0) {
      alert('Please add at least one question to the set');
      return;
    }

    try {
      const quizSets: Array<{ setID: string; questNum: number; bonusNum: number }> = [];

      for (const q of this.selectedQuestions) {
        quizSets.push({
          setID: this.setID.trim(),
          questNum: q.questionID,
          bonusNum: q.isBonus ? q.questionID : 0
        });
      }

      await this.dbService.batchAddQuizSets(quizSets);
      await this.loadQuizSets();
      this.closeEditor();
      alert(`Quiz set "${this.setID}" saved successfully!`);
    } catch (error) {
      console.error('Error saving quiz set:', error);
      alert('Error saving quiz set. Please try again.');
    }
  }

  onReturn() {
    this.router.navigate(['/']);
  }
}
