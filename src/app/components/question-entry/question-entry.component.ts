import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuestionDetail, QuestionSelect, QuestionType } from '../../models/player.model';

@Component({
  selector: 'app-question-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-entry.component.html',
  styleUrl: './question-entry.component.css'
})
export class QuestionEntryComponent implements OnInit {
  questions: QuestionDetail[] = [];
  types: QuestionType[] = [];
  filteredTypes: QuestionType[] = [];
  
  questionID: number | null = null;
  selectedType: string = '';
  chapter: number | null = null;
  startVerse: number | null = null;
  endVerse: number | null = null;
  question: string = '';
  answer: string = '';
  verseText: string = '';
  
  isNewQuestion = false;
  showDelete = false;
  bookName: string = '';
  bookVersion: string = '';

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTypes();
    await this.loadQuestions();
    const userFile = await this.dbService.getUserFile();
    if (userFile) {
      this.bookName = userFile.book;
      this.bookVersion = userFile.bookVersion || '';
    }
  }

  async loadTypes() {
    this.types = await this.dbService.getAllTypes();
    this.filteredTypes = this.types.filter(t => t.class === 'B' || t.class === 'Q');
  }

  async loadQuestions() {
    this.questions = await this.dbService.getAllQuestions();
    this.questions.sort((a, b) => a.questionID - b.questionID);
  }

  async onQuestionIDChange() {
    if (!this.questionID || this.questionID <= 0) {
      // Auto-suggest next question ID
      if (this.questions.length > 0) {
        const maxID = Math.max(...this.questions.map(q => q.questionID));
        this.questionID = maxID + 1;
      } else {
        this.questionID = 1;
      }
      this.isNewQuestion = true;
      this.clearForm();
      return;
    }

    const q = await this.dbService.getQuestion(this.questionID);
    if (q) {
      this.isNewQuestion = false;
      this.showDelete = true;
      this.selectedType = q.qDescType;
      this.chapter = q.qChapter;
      this.startVerse = q.qBegVerse;
      this.endVerse = q.qEndVerse;
      this.question = q.qdescription;
      this.answer = q.qAnswer;
      await this.loadVerse();
    } else {
      this.isNewQuestion = true;
      this.showDelete = false;
      this.clearForm();
    }
  }

  async onChapterChange() {
    if (this.chapter && this.startVerse) {
      await this.loadVerse();
    }
  }

  async onVerseChange() {
    if (this.chapter && this.startVerse) {
      if (!this.endVerse || this.endVerse < this.startVerse) {
        this.endVerse = this.startVerse;
      }
      await this.loadVerse();
    }
  }

  async loadVerse() {
    if (this.chapter && this.startVerse && this.endVerse) {
      try {
        this.verseText = await this.dbService.getVerses(
          this.chapter,
          this.startVerse,
          this.endVerse
        );
        if (this.bookName) {
          this.verseText += `\n(${this.bookName} ${this.chapter}:${this.startVerse}${this.startVerse !== this.endVerse ? '-' + this.endVerse : ''})`;
        }
      } catch (error) {
        this.verseText = 'Verse not found';
      }
    }
  }

  clearForm() {
    this.selectedType = '';
    this.chapter = null;
    this.startVerse = null;
    this.endVerse = null;
    this.question = '';
    this.answer = '';
    this.verseText = '';
  }

  async onAccept() {
    if (!this.questionID || this.questionID <= 0) {
      alert('Please enter a valid question ID');
      return;
    }
    if (!this.selectedType) {
      alert('Please select a question type');
      return;
    }
    if (!this.chapter || !this.startVerse || !this.endVerse) {
      alert('Please enter chapter and verse information');
      return;
    }
    if (!this.question.trim()) {
      alert('Question text is required');
      return;
    }

    const questionDetail: QuestionDetail = {
      questionID: this.questionID,
      qdescription: this.question.trim(),
      qAnswer: this.answer.trim() || ' ',
      qChapter: this.chapter,
      qBegVerse: this.startVerse,
      qEndVerse: this.endVerse,
      qDescType: this.selectedType,
      book: this.bookName,
      version: this.bookVersion
    };

    try {
      await this.dbService.addQuestion(questionDetail);
      
      // Update QuestionSelect
      const qs: QuestionSelect = {
        selectionID: this.questionID,
        selectType: this.selectedType,
        selChapter: this.chapter,
        selVerse: this.startVerse,
        primUseCnt: 0,
        bonUseCnt: 0
      };
      await this.dbService.addQuestionSelect(qs);
      
      await this.loadQuestions();
      this.onCancel();
      alert('Question saved successfully!');
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Error saving question. Please try again.');
    }
  }

  onCancel() {
    this.questionID = null;
    this.clearForm();
    this.isNewQuestion = false;
    this.showDelete = false;
  }

  async onDelete() {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    if (!this.questionID) return;

    try {
      await this.dbService.deleteQuestion(this.questionID);
      await this.loadQuestions();
      this.onCancel();
      alert('Question deleted successfully!');
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Error deleting question. Please try again.');
    }
  }

  onVerseTextClick() {
    // Allow copying verse text to question or answer
    if (this.verseText && window.getSelection) {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        // Could add logic to copy selected text
      }
    }
  }

  onReturn() {
    this.router.navigate(['/']);
  }

  // Format the type label consistently with how it appears in the quiz session
  formatTypeLabel(type: QuestionType): string {
    const leadIn = (type.leadIn || '').trim();
    // Clean up the leadIn: remove "a/an" prefix and "question" suffix, then title case
    const cleaned = leadIn
      .replace(/\s+/g, ' ')
      .replace(/^(a|an)\s+/i, '')
      .replace(/\s*question\.?$/i, '')
      .trim();

    if (cleaned) {
      // Title case the result
      const titleCased = cleaned
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${type.typeID} - ${titleCased}`;
    }
    return type.typeID;
  }
}





