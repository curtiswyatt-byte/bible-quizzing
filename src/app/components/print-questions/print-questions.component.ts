import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuestionDetail } from '../../models/player.model';

interface PrintOptions {
  includeAnswers: boolean;
  includeVerseRefs: boolean;
  includeQuestionIDs: boolean;
  includeQuestionTypes: boolean;
  questionsPerPage: number;
  fontSize: 'small' | 'medium' | 'large';
}

@Component({
  selector: 'app-print-questions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './print-questions.component.html',
  styleUrl: './print-questions.component.css'
})
export class PrintQuestionsComponent implements OnInit {
  questions: QuestionDetail[] = [];
  filteredQuestions: QuestionDetail[] = [];
  selectedQuestions: Set<number> = new Set();

  // Filters
  books: string[] = [];
  versions: string[] = [];
  questionTypes: string[] = [];
  selectedBook: string = '';
  selectedVersion: string = '';
  selectedType: string = '';
  searchText: string = '';

  // Quiz sets
  quizSets: { setID: string; count: number }[] = [];
  selectedQuizSet: string = '';

  // Flagged questions from session
  flaggedQuestions: Set<number> = new Set();
  showOnlyFlagged: boolean = false;

  // Print options
  printOptions: PrintOptions = {
    includeAnswers: true,
    includeVerseRefs: true,
    includeQuestionIDs: true,
    includeQuestionTypes: true,
    questionsPerPage: 5,
    fontSize: 'medium'
  };

  // Match history for printing
  matches: { quizID: string; matchID: string; team1: string; team2: string; score1: number; score2: number }[] = [];
  selectedMatch: string = '';

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadQuestions();
    await this.loadQuizSets();
    await this.loadMatches();
    this.loadFlaggedQuestions();
  }

  async loadQuestions() {
    this.questions = await this.dbService.getAllQuestions();

    // Extract unique books, versions, and types
    const bookSet = new Set<string>();
    const versionSet = new Set<string>();
    const typeSet = new Set<string>();

    this.questions.forEach(q => {
      if (q.book) bookSet.add(q.book);
      if (q.version) versionSet.add(q.version);
      if (q.qDescType) typeSet.add(q.qDescType);
    });

    this.books = Array.from(bookSet).sort();
    this.versions = Array.from(versionSet).sort();
    this.questionTypes = Array.from(typeSet).sort();

    this.applyFilters();
  }

  async loadQuizSets() {
    // getAllQuizSets returns just the setID strings
    const setIDs = await this.dbService.getAllQuizSets();

    // Get question counts for each set
    const quizSetData: { setID: string; count: number }[] = [];
    for (const setID of setIDs) {
      const items = await this.dbService.getQuizSet(setID);
      quizSetData.push({ setID, count: items.length });
    }

    this.quizSets = quizSetData.sort((a, b) => a.setID.localeCompare(b.setID));
  }

  async loadMatches() {
    try {
      const db = await this.dbService.getDatabase();
      const tx = db.transaction('matchSummary', 'readonly');
      const store = tx.objectStore('matchSummary');
      const request = store.getAll();

      request.onsuccess = () => {
        this.matches = request.result || [];
      };
    } catch (e) {
      console.error('Failed to load matches:', e);
    }
  }

  loadFlaggedQuestions() {
    const flaggedStr = sessionStorage.getItem('flaggedQuestions');
    if (flaggedStr) {
      try {
        const flagged = JSON.parse(flaggedStr);
        this.flaggedQuestions = new Set(flagged);
      } catch (e) {
        console.error('Failed to load flagged questions:', e);
      }
    }
  }

  applyFilters() {
    let filtered = [...this.questions];

    if (this.selectedBook) {
      filtered = filtered.filter(q => q.book === this.selectedBook);
    }

    if (this.selectedVersion) {
      filtered = filtered.filter(q => q.version === this.selectedVersion);
    }

    if (this.selectedType) {
      filtered = filtered.filter(q => q.qDescType === this.selectedType);
    }

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(q =>
        q.qdescription?.toLowerCase().includes(search) ||
        q.qAnswer?.toLowerCase().includes(search)
      );
    }

    if (this.showOnlyFlagged) {
      filtered = filtered.filter(q => this.flaggedQuestions.has(q.questionID));
    }

    this.filteredQuestions = filtered;
  }

  async loadQuizSetQuestions() {
    if (!this.selectedQuizSet) {
      this.applyFilters();
      return;
    }

    const setItems = await this.dbService.getQuizSet(this.selectedQuizSet);
    const questionIDs = new Set(setItems.map(item => item.questNum));

    this.selectedQuestions.clear();
    this.filteredQuestions = this.questions.filter(q => questionIDs.has(q.questionID));

    // Auto-select all questions from the set
    this.filteredQuestions.forEach(q => this.selectedQuestions.add(q.questionID));
  }

  toggleQuestion(questionID: number) {
    if (this.selectedQuestions.has(questionID)) {
      this.selectedQuestions.delete(questionID);
    } else {
      this.selectedQuestions.add(questionID);
    }
  }

  selectAll() {
    this.filteredQuestions.forEach(q => this.selectedQuestions.add(q.questionID));
  }

  selectNone() {
    this.selectedQuestions.clear();
  }

  isSelected(questionID: number): boolean {
    return this.selectedQuestions.has(questionID);
  }

  isFlagged(questionID: number): boolean {
    return this.flaggedQuestions.has(questionID);
  }

  getSelectedQuestions(): QuestionDetail[] {
    return this.filteredQuestions.filter(q => this.selectedQuestions.has(q.questionID));
  }

  printQuestions() {
    const selected = this.getSelectedQuestions();
    if (selected.length === 0) {
      alert('Please select at least one question to print.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    const fontSize = this.printOptions.fontSize === 'small' ? '10pt' :
                     this.printOptions.fontSize === 'large' ? '14pt' : '12pt';

    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Bible Quiz Questions</title>
  <style>
    body {
      font-family: Georgia, serif;
      font-size: ${fontSize};
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    h1 {
      text-align: center;
      font-size: 1.5em;
      margin-bottom: 0.5in;
    }
    .question {
      margin-bottom: 0.3in;
      page-break-inside: avoid;
    }
    .question-header {
      font-weight: bold;
      margin-bottom: 0.1in;
    }
    .question-meta {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 0.05in;
    }
    .question-text {
      margin-bottom: 0.1in;
    }
    .answer {
      margin-left: 0.25in;
      border-left: 2px solid #333;
      padding-left: 0.15in;
    }
    .answer-label {
      font-weight: bold;
    }
    .verse-ref {
      font-style: italic;
      color: #555;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      body { margin: 0; padding: 0.25in; }
    }
  </style>
</head>
<body>
  <h1>Bible Quiz Questions</h1>
`;

    selected.forEach((q, index) => {
      html += `<div class="question">`;
      html += `<div class="question-header">Question ${index + 1}`;
      if (this.printOptions.includeQuestionIDs) {
        html += ` <span style="font-weight: normal; color: #888;">(ID: ${q.questionID})</span>`;
      }
      html += `</div>`;

      if (this.printOptions.includeQuestionTypes || this.printOptions.includeVerseRefs) {
        html += `<div class="question-meta">`;
        if (this.printOptions.includeQuestionTypes && q.qDescType) {
          html += `Type: ${q.qDescType} `;
        }
        if (this.printOptions.includeVerseRefs && q.qChapter) {
          html += `<span class="verse-ref">${q.book || ''} ${q.qChapter}`;
          if (q.qBegVerse) {
            html += `:${q.qBegVerse}`;
            if (q.qEndVerse && q.qEndVerse !== q.qBegVerse) {
              html += `-${q.qEndVerse}`;
            }
          }
          html += `</span>`;
        }
        html += `</div>`;
      }

      html += `<div class="question-text">${this.escapeHtml(q.qdescription || '')}</div>`;

      if (this.printOptions.includeAnswers) {
        html += `<div class="answer"><span class="answer-label">Answer:</span> ${this.escapeHtml(q.qAnswer || '')}</div>`;
      }

      html += `</div>`;

      // Page break after every N questions
      if (this.printOptions.questionsPerPage > 0 &&
          (index + 1) % this.printOptions.questionsPerPage === 0 &&
          index < selected.length - 1) {
        html += `<div class="page-break"></div>`;
      }
    });

    html += `
  <div style="margin-top: 0.5in; text-align: center; font-size: 0.8em; color: #888;">
    Generated ${new Date().toLocaleDateString()} - ${selected.length} questions
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  async printMatch() {
    if (!this.selectedMatch) {
      alert('Please select a match to print.');
      return;
    }

    const [quizID, matchID] = this.selectedMatch.split('|');
    const match = this.matches.find(m => m.quizID === quizID && m.matchID === matchID);
    if (!match) {
      alert('Match not found.');
      return;
    }

    // Get match details
    const details = await this.dbService.getMatchDetails(quizID, matchID);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Match Report - ${match.team1} vs ${match.team2}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    h1 { text-align: center; margin-bottom: 0.1in; }
    h2 { text-align: center; font-size: 1.2em; color: #555; margin-bottom: 0.3in; }
    .score-box {
      display: flex;
      justify-content: center;
      gap: 1in;
      margin-bottom: 0.3in;
      font-size: 1.3em;
    }
    .team-score {
      text-align: center;
      padding: 0.2in;
      border: 2px solid #333;
      border-radius: 8px;
      min-width: 2in;
    }
    .team-name { font-weight: bold; }
    .score { font-size: 1.5em; color: #1E40AF; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.3in;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 0.1in;
      text-align: left;
    }
    th { background: #f0f0f0; }
    .correct { color: green; }
    .wrong { color: red; }
    @media print {
      body { margin: 0; padding: 0.25in; }
    }
  </style>
</head>
<body>
  <h1>Match Report</h1>
  <h2>${match.team1} vs ${match.team2}</h2>
  <div class="score-box">
    <div class="team-score">
      <div class="team-name">${match.team1}</div>
      <div class="score">${match.score1}</div>
    </div>
    <div class="team-score">
      <div class="team-name">${match.team2}</div>
      <div class="score">${match.score2}</div>
    </div>
  </div>
`;

    if (details.length > 0) {
      html += `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>Action</th>
        <th>Player</th>
        <th>Points</th>
      </tr>
    </thead>
    <tbody>
`;
      details.filter(d => !d.canceled).forEach((d, i) => {
        const actionClass = d.action === 'Correct' ? 'correct' : d.action === 'Wrong' ? 'wrong' : '';
        html += `
      <tr>
        <td>${d.questNum}</td>
        <td>${d.questType === 'B' ? 'Bonus' : 'Primary'}</td>
        <td class="${actionClass}">${d.action}</td>
        <td>Player #${d.actionPlayer}</td>
        <td>${d.points}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    html += `
  <div style="margin-top: 0.5in; text-align: center; font-size: 0.8em; color: #888;">
    Quiz ID: ${quizID} | Match ID: ${matchID} | Generated ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
