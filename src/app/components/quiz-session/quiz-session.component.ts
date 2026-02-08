import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { QuizStateService } from '../../services/quiz-state.service';
import { TournamentService } from '../../services/tournament.service';
import { QuestionDetail, MatchDetail, MatchSummary, Parms, TeamRoster, TeamChair, QuestionType } from '../../models/player.model';
import { MatchSettings } from '../../models/match-settings.model';
import { SubstitutionDialogComponent, SubstitutionOption, ChairOption } from '../substitution-dialog/substitution-dialog.component';
import { TimeoutDialogComponent } from '../timeout-dialog/timeout-dialog.component';
import { AppealDialogComponent } from '../appeal-dialog/appeal-dialog.component';

@Component({
  selector: 'app-quiz-session',
  standalone: true,
  imports: [CommonModule, FormsModule, SubstitutionDialogComponent, TimeoutDialogComponent, AppealDialogComponent],
  templateUrl: './quiz-session.component.html',
  styleUrl: './quiz-session.component.css'
})
export class QuizSessionComponent implements OnInit, OnDestroy {
  matchState: any = null;
  currentQuestion: QuestionDetail | null = null;
  questionText: string = '';
  answerText: string = '';
  verseText: string = '';
  verseWarning: string = '';
  questionID: number | null = null;
  questionNum: number = 0;
  setID: string = '';
  questionIntro: string = '';
  questionTypeLabel: string = '';
  referenceLabel: string = '';
  settings: MatchSettings | null = null;

  selectedTeam1Chair: number = -1;
  selectedTeam2Chair: number = -1;

  questionAnswered: boolean = false;
  fouledPlayers: Set<number> = new Set(); // Track players fouled on current question

  // Track players who have quizzed out (can still answer bonus questions even if subbed)
  quizOutPlayers: Set<number> = new Set();
  // Track players who have errored out (cannot answer any questions including bonuses)
  errorOutPlayers: Set<number> = new Set();

  // Track flagged questions for review
  flaggedQuestions: Set<number> = new Set();

  // Current bonus question ID (from quiz set BonusNum)
  currentBonusQuestionID: number | null = null;

  parms: Parms | null = null;
  questArr: number[] = [];
  availableQuestions: number[] = [];

  timer: number = 0;
  timerInterval: any = null;
  timerActive = false;
  timerWarn = false;
  timerExpired = false;

  // Substitution dialog state
  showSubDialog = false;
  subDialogTeamName = '';
  subDialogChairs: ChairOption[] = [];
  subDialogAvailableSubs: SubstitutionOption[] = [];
  subDialogAutoChairIndex: number | null = null;
  subDialogAutoReason = '';
  subDialogTeam: 1 | 2 = 1;
  private subDialogResolve: ((value: boolean) => void) | null = null;

  // Timeout dialog state
  showTimeoutDialog = false;
  timeoutTeamName = '';
  timeoutDuration = 60;

  // Appeal dialog state
  showAppealDialog = false;
  appealTeamName = '';
  appealDuration = 90;

  // Pending substitution (deferred until bonus question completes)
  private pendingSubstitution: { team: 1 | 2; reason: string } | null = null;

  private verseMap = new Map<string, string>();
  private questionTypeMap = new Map<string, { leadIn: string; class?: string }>();
  private typeCacheInitialized = false;

  constructor(
    private dbService: DatabaseService,
    private quizState: QuizStateService,
    private router: Router,
    private tournamentService: TournamentService
  ) {}

  async ngOnInit() {
    this.matchState = this.quizState.getMatchState();
    if (!this.matchState) {
      this.router.navigate(['/select-question']);
      return;
    }

    this.settings = this.matchState.matchSettings ?? null;

    if (this.matchState.verseLookupEntries) {
      this.verseMap = new Map<string, string>(this.matchState.verseLookupEntries);
    }
    if (this.matchState.questionTypeEntries) {
      this.questionTypeMap = new Map<string, { leadIn: string; class?: string }>(this.matchState.questionTypeEntries);
      this.typeCacheInitialized = true;
    }

    this.questionNum = this.matchState.questionNum || 0;
    this.setID = this.matchState.setID || '';
    
    await this.loadParms();
    await this.loadQuestionSet();

    // If we already have a question loaded, reload it
    if (this.questionNum > 0 && this.matchState.currentQuestionID) {
      await this.loadQuestion(this.matchState.currentQuestionID);
    }

    // Load flagged questions from session storage
    const flaggedStr = sessionStorage.getItem('flaggedQuestions');
    if (flaggedStr) {
      try {
        const flagged = JSON.parse(flaggedStr);
        this.flaggedQuestions = new Set(flagged);
      } catch (e) {
        console.error('Failed to load flagged questions:', e);
      }
    }

    this.updateDisplay();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  async loadParms() {
    const userFile = await this.dbService.getUserFile();
    if (userFile) {
      this.parms = await this.dbService.getParms(userFile.book);
      if (!this.parms) {
        // Use defaults
        this.parms = {
          book: userFile.book,
          quizOutNum: 4,
          errOutNum: 3,
          foulOutNum: 3,
          timeouts: 2,
          matchLength: 20,
          quizOutPoints: 10,
          errOutPoints: 10,
          foulOutPoints: 10,
          penaltyNum: 17,
          corrPoints: 20,
          bonusPoints: 10,
          tieBreaker: 3
        };
      }
    }
  }

  async loadQuestionSet() {
    if (!this.matchState.setID) {
      this.availableQuestions = [];
      return;
    }

    const setID = this.matchState.setID;

    const loadFromDatabase = async () => {
      const setItems = await this.dbService.getQuizSet(setID);
      const queue = setItems.map(item => ({ questNum: item.questNum, bonusNum: item.bonusNum }));
      this.matchState.questionQueue = queue;
      this.matchState.questionIds = queue.map(q => q.questNum);
      this.matchState.totalQuestions = queue.length;
      this.matchState.questionHistory = [];
      this.availableQuestions = [...(this.matchState.questionIds || [])];
      this.questArr = queue.map(q => q.questNum);
      this.quizState.setMatchState({ ...this.matchState });
      this.matchState = this.quizState.getMatchState();
      console.log(`Loaded ${queue.length} questions from set ${setID}`);
    };

    if (this.matchState.questionQueue && this.matchState.questionQueue.length > 0) {
      this.availableQuestions = this.matchState.questionQueue.map((q: { questNum: number }) => q.questNum);
      this.questArr = this.availableQuestions.map((q: number) => q);
      console.log(`Loaded ${this.availableQuestions.length} cached questions from set ${setID}`);
    } else {
      await loadFromDatabase();
    }

    if (this.availableQuestions.length === 0) {
      console.warn(`Question set ${setID} returned no questions.`);
    }
  }

  async loadQuestion(questionID: number) {
    console.log(`Loading question ID: ${questionID}`);
    let question: QuestionDetail | null = null;
    if (this.matchState.questionLookupEntries) {
      const map = new Map<number, QuestionDetail>(this.matchState.questionLookupEntries);
      question = map.get(questionID) || null;
    }
    if (!question && this.matchState.questionBank) {
      question = this.matchState.questionBank.find((q: QuestionDetail) => q.questionID === questionID) || null;
    }
    if (!question) {
      question = await this.dbService.getQuestion(questionID);
    }
    if (!question) {
      console.error(`Question ${questionID} not found in database or dataset cache`);
      alert(`Question ${questionID} not found. Please check your question data.`);
      return;
    }

    this.currentQuestion = question;
    this.questionID = questionID;
    this.questionText = (question.qdescription || '').trim();
    this.answerText = (question.qAnswer || '').trim();

    const typeInfo = await this.getQuestionTypeInfo(question.qDescType);
    const leadIn = typeInfo?.leadIn?.trim() || 'a question';
    this.questionIntro = `Question number ${this.questionNum} is ${this.formatLeadIn(leadIn)}.`;
    this.questionTypeLabel = this.buildQuestionTypeLabel(leadIn, question.qDescType);

    if (question.qChapter) {
      const book = (this.parms?.book || '').trim();
      // Check if question type indicates "chapter only" (ignore verse even if present in DB)
      const isChapterOnly = leadIn.toLowerCase().includes('chapter only');
      const hasVerse = !isChapterOnly && question.qBegVerse && question.qBegVerse > 0;

      // Build reference label (only if verse is provided and not chapter-only)
      if (hasVerse) {
        let ref = `${book ? book + ' ' : ''}${question.qChapter}:${question.qBegVerse}`;
        if (question.qEndVerse && question.qEndVerse !== question.qBegVerse) {
          ref += `-${question.qEndVerse}`;
        }
        this.referenceLabel = ref;
      } else {
        // Chapter only
        this.referenceLabel = `${book ? book + ' ' : ''}${question.qChapter}`;
      }

      // If question text is empty (like QUOTE questions), format it with "Quote" and spell out Chapter/Verse
      if (!this.questionText) {
        let fullRef = book ? book + ' ' : '';
        if (hasVerse) {
          fullRef += `Chapter ${question.qChapter} Verse ${question.qBegVerse}`;
          if (question.qEndVerse && question.qEndVerse !== question.qBegVerse) {
            fullRef += ` through ${question.qEndVerse}`;
          }
        } else {
          fullRef += `Chapter ${question.qChapter}`;
        }
        this.questionText = `Quote ${fullRef}`;
      }
      // For FINISH REFERENCE and INTERROGATIVE REFERENCE questions, prepend "According to [Book] Chapter X"
      else if (this.questionText && leadIn.toLowerCase().includes('reference')) {
        let prefix = 'According to ';
        if (book) {
          prefix += `${book} `;
        }
        prefix += `Chapter ${question.qChapter}`;

        // Only add verse reference if not chapter-only
        if (hasVerse) {
          prefix += ` Verse ${question.qBegVerse}`;
          if (question.qEndVerse && question.qEndVerse !== question.qBegVerse) {
            prefix += ` through ${question.qEndVerse}`;
          }
        }
        this.questionText = `${prefix} ${this.questionText}`;
      }
    } else {
      this.referenceLabel = '';
    }

    if (question.qChapter && question.qBegVerse) {
      const verseText = await this.getVerseRangeText(
        question.qChapter,
        question.qBegVerse,
        question.qEndVerse || question.qBegVerse
      );
      if (verseText) {
        this.verseText = verseText;
        this.verseWarning = '';
      } else {
        const ref = `${question.qChapter}:${question.qBegVerse}${question.qEndVerse && question.qEndVerse !== question.qBegVerse ? '-' + question.qEndVerse : ''}`;
        this.verseText = '';
        this.verseWarning = `Verse ${ref} not found in dataset.`;
      }
    } else {
      this.verseText = '';
      this.verseWarning = '';
    }
  }

  private async getQuestionTypeInfo(typeID: string): Promise<{ leadIn: string; class?: string } | null> {
    if (!typeID) {
      return null;
    }
    if (this.questionTypeMap.has(typeID)) {
      return this.questionTypeMap.get(typeID) || null;
    }
    if (!this.typeCacheInitialized) {
      const types = await this.dbService.getAllTypes();
      types.forEach((type: QuestionType) => {
        this.questionTypeMap.set(type.typeID, {
          leadIn: (type.leadIn || '').trim(),
          class: type.class?.trim() || undefined
        });
      });
      this.typeCacheInitialized = true;
    }
    return this.questionTypeMap.get(typeID) || null;
  }

  private async getVerseRangeText(chapter: number, beginVerse: number, endVerse: number): Promise<string> {
    if (!chapter || !beginVerse) {
      return '';
    }
    const start = Math.min(beginVerse, endVerse || beginVerse);
    const finish = Math.max(beginVerse, endVerse || beginVerse);
    const segments: string[] = [];
    let complete = true;

    if (this.verseMap.size) {
      for (let verse = start; verse <= finish; verse++) {
        const key = `${chapter}:${verse}`;
        const text = this.verseMap.get(key);
        if (!text) {
          complete = false;
          break;
        }
        segments.push(`${chapter}:${verse} ${text}`.trim());
      }
      if (complete && segments.length) {
        return segments.join('\n');
      }
      segments.length = 0;
    }

    const fromDb = await this.dbService.getVerses(chapter, start, finish);
    return fromDb || '';
  }

  private formatLeadIn(leadIn: string): string {
    const trimmed = leadIn.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      return 'a question';
    }
    const lower = trimmed.toLowerCase();
    // Check if it starts with "a " or "an " and capitalize the word after it
    if (lower.startsWith('an ')) {
      const rest = trimmed.slice(3); // Skip "an "
      return 'an ' + rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    if (lower.startsWith('a ')) {
      const rest = trimmed.slice(2); // Skip "a "
      return 'a ' + rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  private buildQuestionTypeLabel(leadIn: string, fallback: string): string {
    const cleaned = leadIn
      .replace(/\s+/g, ' ')
      .replace(/^(a|an)\s+/i, '')
      .replace(/\s*question\.?$/i, '')
      .trim();
    if (cleaned) {
      return this.toTitleCase(cleaned);
    }
    return fallback ? fallback.toUpperCase() : 'QUESTION';
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  updateDisplay() {
    // Update scores and stats display
    if (this.matchState) {
      // Display will be updated via template binding
    }
  }

  private handleChairSelection(team: 1 | 2, index: number, options: { auto?: boolean; bonusContext?: boolean; skipTimer?: boolean } = {}): boolean {
    if (!this.matchState) {
      return false;
    }

    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const chair = chairs[index];
    if (!chair || chair.playerNumber === 0) {
      if (!options.auto) {
        alert('No player is assigned to that chair.');
      }
      return false;
    }

    const rosterEntry = this.getRosterEntry(team, chair.playerNumber);
    const isBonusAttempt = this.matchState.bonusQuestion;

    if (!rosterEntry) {
      if (!options.auto) {
        alert('Unable to locate player in roster.');
      }
      return false;
    }

    // Check error-out status - these players cannot answer ANY questions including bonuses
    if (this.errorOutPlayers.has(chair.playerNumber) || rosterEntry.errorOut) {
      if (isBonusAttempt) {
        alert(`${chair.name} has errored out and is NOT eligible to answer bonus questions.`);
      } else {
        alert(`${chair.name} has errored out and cannot answer.`);
      }
      return false;
    }

    // Check quiz-out status for regular questions only
    // Quiz-out players CAN answer bonus questions
    if (!isBonusAttempt && (this.quizOutPlayers.has(chair.playerNumber) || rosterEntry.quizOut)) {
      if (!options.auto) {
        alert(`${chair.name} has quizzed out and may only answer bonus questions.`);
      }
      return false;
    }

    if (team === 1) {
      this.selectedTeam1Chair = index;
      this.selectedTeam2Chair = -1;
    } else {
      this.selectedTeam2Chair = index;
      this.selectedTeam1Chair = -1;
    }

    // Only start timer when user explicitly clicks (not auto-selected for bonus)
    if (!options.skipTimer) {
      this.startTimer();
    }
    return true;
  }

  private getRosterEntry(team: 1 | 2, playerNumber: number): TeamRoster | undefined {
    if (!this.matchState) {
      return undefined;
    }
    const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
    return roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
  }

  private updateChairStatus(team: 1 | 2, rosterEntry: TeamRoster): void {
    if (!this.matchState) {
      return;
    }
    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const chair = chairs.find((c: TeamChair | null) => c && c.playerNumber === rosterEntry.playerNumber);
    if (chair) {
      chair.quizOut = rosterEntry.quizOut;
      chair.errorOut = rosterEntry.errorOut;
      chair.bonusOnly = rosterEntry.bonusOnly;
    }
  }

  private async handleQuizOutIfNeeded(team: 1 | 2, rosterEntry: TeamRoster): Promise<void> {
    const settings = this.settings;
    console.log('handleQuizOutIfNeeded:', {
      settings,
      rosterEntry,
      quizOutCorrect: settings?.quizOutCorrect,
      playerCorrect: rosterEntry.correct,
      alreadyQuizOut: rosterEntry.quizOut
    });

    if (!settings || rosterEntry.quizOut) {
      console.log('Quiz-out check skipped: no settings or already quizzed out');
      return;
    }

    if (rosterEntry.correct < settings.quizOutCorrect) {
      console.log(`Not enough correct answers for quiz-out: ${rosterEntry.correct} < ${settings.quizOutCorrect}`);
      return;
    }

    console.log('Player has quizzed out!');
    rosterEntry.quizOut = true;
    // IMPORTANT: Quiz-out players can ALWAYS answer bonus questions, even if subbed out and back in
    // We track this permanently in quizOutPlayers set
    this.quizOutPlayers.add(rosterEntry.playerNumber);

    const hasSub = this.hasAvailableSubstitute(team);
    console.log('Has available substitute:', hasSub);
    rosterEntry.bonusOnly = true; // Quiz-out players can answer bonuses regardless of sub status
    this.updateChairStatus(team, rosterEntry);

    if (settings.quizOutBonusPoints) {
      if (team === 1) {
        this.matchState.team1Score += settings.quizOutBonusPoints;
      } else {
        this.matchState.team2Score += settings.quizOutBonusPoints;
      }
    }

    const playerName = this.getPlayerLabel(team, rosterEntry.playerNumber);
    if (hasSub) {
      // Quiz out happens on correct answer - substitute immediately
      alert(`${playerName} has quizzed out and will be substituted. They can still answer bonus questions if subbed back in.`);
      await this.showSubstituteDialog(team, true);
    } else {
      alert(`${playerName} has quizzed out. No substitutes remain, so they may only answer bonus questions.`);
    }
  }

  private async handleErrorOutIfNeeded(team: 1 | 2, rosterEntry: TeamRoster): Promise<void> {
    const settings = this.settings;
    if (!settings || rosterEntry.errorOut) {
      return;
    }

    if (rosterEntry.errors < settings.errorOutMisses) {
      return;
    }

    rosterEntry.errorOut = true;
    // IMPORTANT: Error-out players CANNOT answer bonus questions - track permanently
    this.errorOutPlayers.add(rosterEntry.playerNumber);

    const hasSub = this.hasAvailableSubstitute(team);
    rosterEntry.bonusOnly = false; // Error-out players cannot answer any questions, even bonuses
    this.updateChairStatus(team, rosterEntry);

    // Apply error-out penalty (errorOutPenaltyPoints is stored as negative)
    if (settings.errorOutPenaltyPoints) {
      if (team === 1) {
        this.matchState.team1Score += settings.errorOutPenaltyPoints;
      } else {
        this.matchState.team2Score += settings.errorOutPenaltyPoints;
      }
    }

    const playerName = this.getPlayerLabel(team, rosterEntry.playerNumber);
    if (hasSub) {
      // Defer substitution until bonus question completes (if any)
      this.pendingSubstitution = { team, reason: 'errored out' };
      alert(`${playerName} has errored out and will be substituted after the bonus question.\n\n⚠️ REMINDER: ${playerName} is NOT eligible to answer bonus questions.`);
    } else {
      alert(`${playerName} has errored out. No substitutes remain.\n\n⚠️ REMINDER: ${playerName} is NOT eligible to answer any questions, including bonus questions.`);
    }
  }

  private async handleFoulOutIfNeeded(team: 1 | 2, rosterEntry: TeamRoster): Promise<void> {
    const settings = this.settings;
    if (!settings) {
      return;
    }

    // Check if player has reached foul-out limit (use settings, fallback to parms)
    const foulsToFoulOut = settings.foulsToFoulOut || this.parms?.foulOutNum || 2;
    if (rosterEntry.fouls < foulsToFoulOut) {
      return;
    }

    // Mark as errored out (fouls result in same outcome as errors - player is eliminated)
    rosterEntry.errorOut = true;
    const hasSub = this.hasAvailableSubstitute(team);
    rosterEntry.bonusOnly = false; // Foul-out players cannot answer any questions, even bonuses
    this.updateChairStatus(team, rosterEntry);

    // Apply foul-out penalty (use settings, fallback to parms)
    const foulOutPenalty = settings.foulOutPenalty ?? this.parms?.foulOutPoints ?? -10;
    if (foulOutPenalty) {
      if (team === 1) {
        this.matchState.team1Score += foulOutPenalty; // foulOutPenalty is already negative
      } else {
        this.matchState.team2Score += foulOutPenalty; // foulOutPenalty is already negative
      }
    }

    const playerName = this.getPlayerLabel(team, rosterEntry.playerNumber);
    if (hasSub) {
      // Defer substitution until the current question completes (foul happens mid-question)
      this.pendingSubstitution = { team, reason: 'fouled out' };
      alert(`${playerName} has fouled out and will be substituted after this question.`);
    } else {
      alert(`${playerName} has fouled out. No substitutes remain, so they may not answer any questions.`);
    }
  }

  private async processPendingSubstitution(): Promise<void> {
    if (!this.pendingSubstitution) {
      return;
    }

    const { team } = this.pendingSubstitution;
    this.pendingSubstitution = null;

    // Show the substitution dialog now that the question is complete
    await this.showSubstituteDialog(team, true);
  }

  private getPlayerLabel(team: 1 | 2, playerNumber: number): string {
    if (!this.matchState) {
      return 'Player';
    }
    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const chair = chairs.find((c: TeamChair | null) => c && c.playerNumber === playerNumber);
    if (chair?.name) {
      return chair.name;
    }
    const rosterEntry = this.getRosterEntry(team, playerNumber);
    if (rosterEntry) {
      return `Player #${rosterEntry.playerNumber}`;
    }
    return 'Player';
  }

  private hasAvailableSubstitute(team: 1 | 2): boolean {
    if (!this.matchState) {
      return false;
    }
    const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const activeNumbers = new Set<number>();
    chairs.forEach((chair: TeamChair | null) => {
      if (chair && chair.playerNumber) {
        activeNumbers.add(chair.playerNumber);
      }
    });
    return roster.some((player: TeamRoster) => !activeNumbers.has(player.playerNumber));
  }

  private async prepareBonusQuestion(missedTeam: 1 | 2, seatIndex: number): Promise<boolean> {
    if (!this.matchState) {
      return false;
    }

    const bonusTeam: 1 | 2 = missedTeam === 1 ? 2 : 1;
    const chairs = bonusTeam === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const chair = chairs[seatIndex];

    if (!chair || !chair.playerNumber) {
      return false;
    }

    // Check if player has errored out (cannot answer bonuses)
    if (this.errorOutPlayers.has(chair.playerNumber)) {
      alert(`${chair.name} has errored out and is NOT eligible to answer bonus questions.`);
      return false;
    }

    const rosterEntry = this.getRosterEntry(bonusTeam, chair.playerNumber);
    if (!rosterEntry) {
      return false;
    }

    if (rosterEntry.errorOut) {
      alert(`${chair.name} has errored out and is NOT eligible to answer bonus questions.`);
      return false;
    }

    // Quiz-out players CAN answer bonus questions (this is allowed)
    // No check needed - they are eligible

    this.matchState.bonusQuestion = true;
    this.matchState.pendingBonusTeam = bonusTeam;
    this.matchState.pendingBonusSeat = seatIndex;
    this.matchState.finishQuest = false;

    // Load the actual bonus question from the quiz set
    await this.loadBonusQuestion();

    // Show bonus question notification - clock does NOT start until they click player name
    alert(`Bonus question for ${chair.name}. Click on their name to start the clock.`);

    // Pre-select the bonus player but DON'T start the timer yet
    if (bonusTeam === 1) {
      this.selectedTeam1Chair = seatIndex;
      this.selectedTeam2Chair = -1;
    } else {
      this.selectedTeam2Chair = seatIndex;
      this.selectedTeam1Chair = -1;
    }

    return true;
  }

  private async loadBonusQuestion(): Promise<void> {
    if (!this.matchState || !this.currentQuestion) {
      return;
    }

    // Find the bonus question ID from the quiz set
    const currentQuestionID = this.currentQuestion.questionID;
    let bonusQuestionID: number | null = null;

    // Look up the bonus question ID from the question queue
    if (this.matchState.questionHistory && this.matchState.questionHistory.length > 0) {
      // The current question was just added to history, find its bonus
      const originalQueue = await this.dbService.getQuizSet(this.setID);
      const queueItem = originalQueue.find(q => q.questNum === currentQuestionID);
      if (queueItem && queueItem.bonusNum && queueItem.bonusNum > 0) {
        bonusQuestionID = queueItem.bonusNum;
      }
    }

    if (bonusQuestionID && bonusQuestionID !== currentQuestionID) {
      console.log(`Loading bonus question ID: ${bonusQuestionID} (original was ${currentQuestionID})`);
      this.currentBonusQuestionID = bonusQuestionID;
      await this.loadQuestion(bonusQuestionID);
      // Update the intro to indicate this is a bonus
      this.questionIntro = `BONUS: ${this.questionIntro}`;
    } else {
      console.log('No separate bonus question found, using same question');
      this.currentBonusQuestionID = null;
    }
  }

  onTeam1ChairSelect(index: number) {
    this.handleChairSelection(1, index);
  }

  onTeam2ChairSelect(index: number) {
    this.handleChairSelection(2, index);
  }

  async onJumpIn() {
    if (this.selectedTeam1Chair === -1 && this.selectedTeam2Chair === -1) {
      alert('Please select a player');
      return;
    }
    
    // Open jump in dialog
    // For now, we'll handle it inline
    this.startTimer();
  }

  async onCorrect() {
    if (!this.currentQuestion || !this.matchState) return;

    const team = this.selectedTeam1Chair !== -1 ? 1 : 2;
    const chairIndex = team === 1 ? this.selectedTeam1Chair : this.selectedTeam2Chair;
    const chair = team === 1 ? this.matchState.team1Chairs[chairIndex] : this.matchState.team2Chairs[chairIndex];

    if (!chair || chair.playerNumber === 0) {
      alert('Please select a player');
      return;
    }

    // Check if player has been fouled on this question
    if (this.fouledPlayers.has(chair.playerNumber)) {
      alert(`${chair.name} has been fouled on this question and cannot answer it.`);
      return;
    }

    // Check if question already answered (only for non-bonus questions)
    if (!this.matchState.bonusQuestion && this.questionAnswered) {
      alert('This question has already been answered. Only one player can score per question.');
      return;
    }

    const basePoints = this.parms?.corrPoints ?? 20;
    const bonusPoints = this.settings?.bonusQuestionPoints ?? this.parms?.bonusPoints ?? 10;
    const points = this.matchState.bonusQuestion ? bonusPoints : basePoints;

    // Clear previous answer indicators from all chairs (only for non-bonus)
    if (!this.matchState.bonusQuestion) {
      this.matchState.team1Chairs.forEach((c: TeamChair | null) => {
        if (c) c.lastAnswerCorrect = null;
      });
      this.matchState.team2Chairs.forEach((c: TeamChair | null) => {
        if (c) c.lastAnswerCorrect = null;
      });
    }

    // Mark this chair as correct
    chair.lastAnswerCorrect = true;
    if (!this.matchState.bonusQuestion) {
      this.questionAnswered = true;
    }

    // Update score
    if (team === 1) {
      this.matchState.team1Score += points;
    } else {
      this.matchState.team2Score += points;
    }

    // Update player stats
    const rosterIndex = team === 1
      ? this.matchState.team1Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber)
      : this.matchState.team2Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber);

    if (rosterIndex >= 0) {
      const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
      roster[rosterIndex].activeQuestions++;
      if (this.matchState.bonusQuestion) {
        roster[rosterIndex].bonusCorrect++;
      } else {
        roster[rosterIndex].correct++;
        this.handleQuizOutIfNeeded(team, roster[rosterIndex]);
      }
    }

    await this.recordAction('Correct', chair.playerNumber, points);
    this.matchState.finishQuest = true;
    this.matchState.bonusQuestion = false;
    this.matchState.pendingBonusTeam = null;
    this.matchState.pendingBonusSeat = null;
    this.quizState.setMatchState(this.matchState);
    this.updateDisplay();
    this.stopTimer();

    // Process any pending substitution now that the question is complete
    await this.processPendingSubstitution();
  }

  async onWrong() {
    if (!this.currentQuestion || !this.matchState) return;

    const team = this.selectedTeam1Chair !== -1 ? 1 : 2;
    const chairIndex = team === 1 ? this.selectedTeam1Chair : this.selectedTeam2Chair;
    const chair = team === 1 ? this.matchState.team1Chairs[chairIndex] : this.matchState.team2Chairs[chairIndex];

    if (!chair || chair.playerNumber === 0) {
      alert('Please select a player');
      return;
    }

    // Check if player has been fouled on this question
    if (this.fouledPlayers.has(chair.playerNumber)) {
      alert(`${chair.name} has been fouled on this question and cannot answer it.`);
      return;
    }

    // Check if question already answered (only for non-bonus questions)
    if (!this.matchState.bonusQuestion && this.questionAnswered) {
      alert('This question has already been answered. Only one player can score per question.');
      return;
    }

    this.stopTimer();

    // Clear previous answer indicators from all chairs (only for non-bonus)
    if (!this.matchState.bonusQuestion) {
      this.matchState.team1Chairs.forEach((c: TeamChair | null) => {
        if (c) c.lastAnswerCorrect = null;
      });
      this.matchState.team2Chairs.forEach((c: TeamChair | null) => {
        if (c) c.lastAnswerCorrect = null;
      });
    }

    // Mark this chair as incorrect
    chair.lastAnswerCorrect = false;
    if (!this.matchState.bonusQuestion) {
      this.questionAnswered = true;
    }

    // Update player stats
    const rosterIndex = team === 1
      ? this.matchState.team1Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber)
      : this.matchState.team2Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber);

    if (rosterIndex >= 0) {
      const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
      if (this.matchState.bonusQuestion) {
        roster[rosterIndex].bonusErrors++;
      } else {
        roster[rosterIndex].errors++;
        if (team === 1) {
          this.matchState.team1Errors++;
        } else {
          this.matchState.team2Errors++;
        }
        this.handleErrorOutIfNeeded(team, roster[rosterIndex]);
      }
    }

    const wasBonus = this.matchState.bonusQuestion;

    await this.recordAction('Wrong', chair.playerNumber, 0);

    if (wasBonus) {
      this.matchState.bonusQuestion = false;
      this.matchState.pendingBonusTeam = null;
      this.matchState.pendingBonusSeat = null;
      this.matchState.finishQuest = true;
      this.currentBonusQuestionID = null;
    } else {
      const bonusQueued = await this.prepareBonusQuestion(team, chairIndex);
      if (!bonusQueued) {
        this.matchState.finishQuest = true;
      }
    }

    this.quizState.setMatchState(this.matchState);
    this.updateDisplay();

    // Process any pending substitution now that the question is complete (no bonus queued)
    if (this.matchState.finishQuest) {
      await this.processPendingSubstitution();
    }
  }

  async onFoul() {
    if (!this.currentQuestion || !this.matchState) return;

    const team = this.selectedTeam1Chair !== -1 ? 1 : 2;
    const chairIndex = team === 1 ? this.selectedTeam1Chair : this.selectedTeam2Chair;
    const chair = team === 1 ? this.matchState.team1Chairs[chairIndex] : this.matchState.team2Chairs[chairIndex];

    if (!chair || chair.playerNumber === 0) {
      alert('Please select a player');
      return;
    }

    // Update player stats
    const rosterIndex = team === 1
      ? this.matchState.team1Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber)
      : this.matchState.team2Roster.findIndex((r: TeamRoster) => r.playerNumber === chair.playerNumber);

    if (rosterIndex >= 0) {
      const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
      roster[rosterIndex].fouls++;
      if (team === 1) {
        this.matchState.team1Fouls++;
      } else {
        this.matchState.team2Fouls++;
      }

      // Add player to fouled list for this question (ineligible to answer this question)
      this.fouledPlayers.add(chair.playerNumber);

      // Check for foul-out
      await this.handleFoulOutIfNeeded(team, roster[rosterIndex]);
    }

    await this.recordAction('Foul', chair.playerNumber, 0);
    this.quizState.setMatchState(this.matchState);

    // Deselect the fouled player
    this.selectedTeam1Chair = -1;
    this.selectedTeam2Chair = -1;

    this.updateDisplay();
    // DO NOT stop timer - question remains active for other players
  }

  async recordAction(action: string, playerNumber: number, points: number) {
    if (!this.matchState || !this.currentQuestion) return;

    const seqNum = await this.getNextSeqNum();
    const detail: MatchDetail = {
      quizID: this.matchState.quizID,
      matchID: this.matchState.matchID,
      seqNum: seqNum,
      questNum: this.questionNum,
      questType: this.matchState.bonusQuestion ? 'B' : 'P',
      questID: this.currentQuestion.questionID,
      tm1Player1: this.matchState.team1Chairs[0]?.playerNumber || 0,
      tm1Player2: this.matchState.team1Chairs[1]?.playerNumber || 0,
      tm1Player3: this.matchState.team1Chairs[2]?.playerNumber || 0,
      tm1Player4: this.matchState.team1Chairs[3]?.playerNumber || 0,
      tm2Player1: this.matchState.team2Chairs[0]?.playerNumber || 0,
      tm2Player2: this.matchState.team2Chairs[1]?.playerNumber || 0,
      tm2Player3: this.matchState.team2Chairs[2]?.playerNumber || 0,
      tm2Player4: this.matchState.team2Chairs[3]?.playerNumber || 0,
      actionPlayer: playerNumber,
      action: action,
      points: points,
      canceled: false
    };

    await this.dbService.addMatchDetail(detail);
  }

  async getNextSeqNum(): Promise<number> {
    const details = await this.dbService.getMatchDetails(
      this.matchState.quizID,
      this.matchState.matchID
    );
    if (details.length === 0) return 1;
    return Math.max(...details.map(d => d.seqNum)) + 1;
  }

  async onNextQuestion() {
    if (!this.matchState.finishQuest && this.questionNum !== 0) {
      if (!confirm('Current question was not finished. Do you wish to go to the next question?')) {
        return;
      }
    }

    this.stopTimer();

    this.matchState.bonusQuestion = false;
    this.matchState.pendingBonusTeam = null;
    this.matchState.pendingBonusSeat = null;
    this.matchState.finishQuest = false;
    this.selectedTeam1Chair = -1;
    this.selectedTeam2Chair = -1;
    this.questionAnswered = false;
    this.fouledPlayers.clear(); // Clear fouled players for new question

    // Clear answer indicators from all chairs
    this.matchState.team1Chairs.forEach((chair: TeamChair | null) => {
      if (chair) {
        chair.lastAnswerCorrect = null;
      }
    });
    this.matchState.team2Chairs.forEach((chair: TeamChair | null) => {
      if (chair) {
        chair.lastAnswerCorrect = null;
      }
    });
    
    if (this.questionNum === 0) {
      // First question - initialize match summary
      const summary: MatchSummary = {
        quizID: this.matchState.quizID,
        matchID: this.matchState.matchID,
        team1: this.matchState.team1Team,
        team2: this.matchState.team2Team,
        score1: 0,
        score2: 0
      };
      await this.dbService.saveMatchSummary(summary);
    }
    
    this.questionNum++;
    this.matchState.questionNum = this.questionNum;

    const matchLength = this.parms?.matchLength || 20;

    // Select random question from available FIRST
    if (this.availableQuestions.length === 0) {
      await this.loadQuestionSet();
    }

    if (this.availableQuestions.length === 0) {
      alert('No more questions available in this set');
      await this.endMatch();
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.availableQuestions.length);
    const questionID = this.availableQuestions[randomIndex];
    this.availableQuestions.splice(randomIndex, 1);
    if (this.matchState.questionQueue) {
      const queueIndex = this.matchState.questionQueue.findIndex((q: { questNum: number }) => q.questNum === questionID);
      if (queueIndex >= 0) {
        this.matchState.questionQueue.splice(queueIndex, 1);
      }
    }
    if (!this.matchState.questionHistory) {
      this.matchState.questionHistory = [];
    }
    this.matchState.questionHistory.push(questionID);
    this.matchState.questionIds = [...this.availableQuestions];
    this.quizState.setMatchState({ ...this.matchState });
    this.matchState = this.quizState.getMatchState();
    console.log(`Loading question ID ${questionID} (Question ${this.questionNum} of ${matchLength})`);
    this.matchState.currentQuestionID = questionID;
    
    // Load the question
    await this.loadQuestion(questionID);

    // AFTER loading the question, check if we've exceeded match length
    if (this.questionNum > matchLength) {
      // Check for tie or end of match
      if (this.matchState.team1Score === this.matchState.team2Score) {
        this.matchState.tieBreakNum++;
        alert(`The score is tied at ${this.matchState.team1Score}! Entering tie breaker ${this.matchState.tieBreakNum}.`);
        // Continue with tie breaker - don't end match yet
      } else {
        // Match is over, scores are different
        await this.endMatch();
        return;
      }
    }

    this.quizState.setMatchState(this.matchState);
    this.updateDisplay();
  }

  async onReplayQuestion() {
    if (!confirm('Replaying the question will void all results for the current question and use a backup question. Do you wish to continue?')) {
      return;
    }

    if (!this.matchState || !this.currentQuestion) {
      return;
    }

    // Store the old question ID so we can put it back in the available pool
    const oldQuestionID = this.currentQuestion.questionID;

    // Cancel all actions for this question
    const details = await this.dbService.getMatchDetails(
      this.matchState.quizID,
      this.matchState.matchID
    );

    // Track which players had state changes during this question for reversal
    const playersWithQuizOut = new Set<number>();
    const playersWithErrorOut = new Set<number>();
    const playersSubstitutedOut = new Set<number>();
    const playersSubstitutedIn = new Set<number>();
    const chairSubstitutions = new Map<number, { team: 1 | 2; chairIndex: number; oldPlayer: number; newPlayer: number }>();

    for (const detail of details.filter(d => d.questNum === this.questionNum && !d.canceled)) {
      // Reverse the actions
      if (detail.action === 'Correct') {
        // Find which team this player is on
        const team = this.matchState.team1Chairs.some((c: TeamChair) => c?.playerNumber === detail.actionPlayer) ? 1 : 2;
        const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
        const rosterEntry = roster.find((r: TeamRoster) => r.playerNumber === detail.actionPlayer);

        // Reverse score
        if (team === 1) {
          this.matchState.team1Score -= detail.points;
        } else {
          this.matchState.team2Score -= detail.points;
        }

        // Reverse player stats
        if (rosterEntry) {
          rosterEntry.correct = Math.max(0, rosterEntry.correct - 1);
          rosterEntry.activeQuestions = Math.max(0, rosterEntry.activeQuestions - 1);

          // Check if they quizzed out during this question
          if (rosterEntry.quizOut && this.settings && rosterEntry.correct < this.settings.quizOutCorrect) {
            playersWithQuizOut.add(detail.actionPlayer);

            // Reverse quiz-out bonus points if applicable
            if (this.settings.quizOutBonusPoints) {
              if (team === 1) {
                this.matchState.team1Score -= this.settings.quizOutBonusPoints;
              } else {
                this.matchState.team2Score -= this.settings.quizOutBonusPoints;
              }
            }
          }
        }
      } else if (detail.action === 'Wrong' || detail.action === 'Foul') {
        // Find which team this player is on
        const team = this.matchState.team1Chairs.some((c: TeamChair) => c?.playerNumber === detail.actionPlayer) ? 1 :
                     this.matchState.team2Chairs.some((c: TeamChair) => c?.playerNumber === detail.actionPlayer) ? 2 :
                     this.matchState.team1Roster.some((r: TeamRoster) => r.playerNumber === detail.actionPlayer) ? 1 : 2;
        const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
        const rosterEntry = roster.find((r: TeamRoster) => r.playerNumber === detail.actionPlayer);

        if (rosterEntry) {
          rosterEntry.activeQuestions = Math.max(0, rosterEntry.activeQuestions - 1);

          if (detail.action === 'Wrong') {
            rosterEntry.errors = Math.max(0, rosterEntry.errors - 1);

            // Check if they errored out during this question
            if (rosterEntry.errorOut && this.settings && rosterEntry.errors < this.settings.errorOutMisses) {
              playersWithErrorOut.add(detail.actionPlayer);

              // Reverse error-out penalty points if applicable
              if (this.settings.errorOutPenaltyPoints) {
                if (team === 1) {
                  this.matchState.team1Score += Math.abs(this.settings.errorOutPenaltyPoints);
                } else {
                  this.matchState.team2Score += Math.abs(this.settings.errorOutPenaltyPoints);
                }
              }
            }
          } else if (detail.action === 'Foul') {
            rosterEntry.fouls = Math.max(0, rosterEntry.fouls - 1);

            // Check if they fouled out during this question
            if (rosterEntry.errorOut && this.parms && rosterEntry.fouls < this.parms.foulOutNum) {
              playersWithErrorOut.add(detail.actionPlayer);

              // Reverse foul-out penalty points if applicable
              if (this.parms.foulOutPoints) {
                if (team === 1) {
                  this.matchState.team1Score += Math.abs(this.parms.foulOutPoints);
                } else {
                  this.matchState.team2Score += Math.abs(this.parms.foulOutPoints);
                }
              }
            }
          }
        }
      } else if (detail.action.startsWith('Sub:')) {
        // Track substitutions to reverse them
        // Format: "Sub: OldName → NewName"
        playersSubstitutedIn.add(detail.actionPlayer);

        // Find which chair this substitution affected
        for (let i = 0; i < 4; i++) {
          const team1Chair = this.matchState.team1Chairs[i];
          const team2Chair = this.matchState.team2Chairs[i];

          if (team1Chair?.playerNumber === detail.actionPlayer) {
            // Find what the chair lineup was BEFORE this action
            const prevTeam1Chairs = [detail.tm1Player1, detail.tm1Player2, detail.tm1Player3, detail.tm1Player4];
            const oldPlayerNumber = prevTeam1Chairs[i];
            if (oldPlayerNumber && oldPlayerNumber !== detail.actionPlayer) {
              chairSubstitutions.set(detail.actionPlayer, {
                team: 1,
                chairIndex: i,
                oldPlayer: oldPlayerNumber,
                newPlayer: detail.actionPlayer
              });
              playersSubstitutedOut.add(oldPlayerNumber);
            }
          } else if (team2Chair?.playerNumber === detail.actionPlayer) {
            const prevTeam2Chairs = [detail.tm2Player1, detail.tm2Player2, detail.tm2Player3, detail.tm2Player4];
            const oldPlayerNumber = prevTeam2Chairs[i];
            if (oldPlayerNumber && oldPlayerNumber !== detail.actionPlayer) {
              chairSubstitutions.set(detail.actionPlayer, {
                team: 2,
                chairIndex: i,
                oldPlayer: oldPlayerNumber,
                newPlayer: detail.actionPlayer
              });
              playersSubstitutedOut.add(oldPlayerNumber);
            }
          }
        }
      }

      // Mark as canceled
      detail.canceled = true;
      await this.dbService.addMatchDetail(detail);
    }

    // Reverse player state flags
    for (const playerNumber of playersWithQuizOut) {
      const team1Entry = this.matchState.team1Roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
      const team2Entry = this.matchState.team2Roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
      const rosterEntry = team1Entry || team2Entry;
      if (rosterEntry) {
        rosterEntry.quizOut = false;
        rosterEntry.bonusOnly = false;

        // Update chair status
        const team = team1Entry ? 1 : 2;
        this.updateChairStatus(team, rosterEntry);
      }
    }

    for (const playerNumber of playersWithErrorOut) {
      const team1Entry = this.matchState.team1Roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
      const team2Entry = this.matchState.team2Roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
      const rosterEntry = team1Entry || team2Entry;
      if (rosterEntry) {
        rosterEntry.errorOut = false;
        rosterEntry.bonusOnly = false;

        // Update chair status
        const team = team1Entry ? 1 : 2;
        this.updateChairStatus(team, rosterEntry);
      }
    }

    // Reverse substitutions - put the original players back
    for (const [newPlayer, subInfo] of chairSubstitutions) {
      const chairs = subInfo.team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
      const roster = subInfo.team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
      const oldRosterEntry = roster.find((r: TeamRoster) => r.playerNumber === subInfo.oldPlayer);

      if (oldRosterEntry) {
        chairs[subInfo.chairIndex] = {
          playerNumber: oldRosterEntry.playerNumber,
          rosterPosition: subInfo.chairIndex,
          name: oldRosterEntry.nickname || oldRosterEntry.name || `Player ${oldRosterEntry.playerNumber}`,
          quizOut: oldRosterEntry.quizOut,
          errorOut: oldRosterEntry.errorOut,
          bonusOnly: oldRosterEntry.bonusOnly
        };
      }
    }

    // Put the old question back into available pool
    this.availableQuestions.push(oldQuestionID);

    // Remove from question history
    if (this.matchState.questionHistory) {
      const historyIndex = this.matchState.questionHistory.indexOf(oldQuestionID);
      if (historyIndex >= 0) {
        this.matchState.questionHistory.splice(historyIndex, 1);
      }
    }

    // Reset question state
    this.matchState.bonusQuestion = false;
    this.matchState.finishQuest = false;
    this.selectedTeam1Chair = -1;
    this.selectedTeam2Chair = -1;

    // Select a NEW backup question (same logic as onNextQuestion)
    if (this.availableQuestions.length === 0) {
      await this.loadQuestionSet();
    }

    if (this.availableQuestions.length === 0) {
      alert('No backup questions available in this set');
      this.quizState.setMatchState(this.matchState);
      this.updateDisplay();
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.availableQuestions.length);
    const newQuestionID = this.availableQuestions[randomIndex];
    this.availableQuestions.splice(randomIndex, 1);

    if (this.matchState.questionQueue) {
      const queueIndex = this.matchState.questionQueue.findIndex((q: { questNum: number }) => q.questNum === newQuestionID);
      if (queueIndex >= 0) {
        this.matchState.questionQueue.splice(queueIndex, 1);
      }
    }

    if (!this.matchState.questionHistory) {
      this.matchState.questionHistory = [];
    }
    this.matchState.questionHistory.push(newQuestionID);
    this.matchState.questionIds = [...this.availableQuestions];

    // Load the new backup question
    await this.loadQuestion(newQuestionID);

    this.quizState.setMatchState(this.matchState);
    this.updateDisplay();
  }

  async onTimeout(team: 1 | 2) {
    if (team === 1) {
      if (this.matchState.team1TOs <= 0) {
        alert(`${this.matchState.team1Team} has already used its last timeout.`);
        return;
      }
      this.matchState.team1TOs--;
      this.timeoutTeamName = this.matchState.team1Team;
    } else {
      if (this.matchState.team2TOs <= 0) {
        alert(`${this.matchState.team2Team} has already used its last timeout.`);
        return;
      }
      this.matchState.team2TOs--;
      this.timeoutTeamName = this.matchState.team2Team;
    }

    // Get timeout duration from settings
    this.timeoutDuration = this.settings?.timeoutDurationSeconds || 60;

    this.quizState.setMatchState(this.matchState);

    // Show timeout dialog
    this.showTimeoutDialog = true;
  }

  onTimeoutComplete() {
    this.showTimeoutDialog = false;
  }

  async onSubstitute(team: 1 | 2) {
    await this.showSubstituteDialog(team);
  }

  private async showSubstituteDialog(team: 1 | 2, autoTrigger = false): Promise<boolean> {
    if (!this.matchState) {
      return false;
    }

    const teamName = team === 1 ? this.matchState.team1Team : this.matchState.team2Team;
    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;

    // Get available substitutes (roster players not currently in chairs)
    const activeNumbers = new Set<number>();
    chairs.forEach((chair: TeamChair | null) => {
      if (chair && chair.playerNumber) {
        activeNumbers.add(chair.playerNumber);
      }
    });

    const availableSubs = roster.filter((r: TeamRoster) => !activeNumbers.has(r.playerNumber));

    if (availableSubs.length === 0) {
      if (!autoTrigger) {
        alert(`${teamName} has no available substitutes.`);
      }
      return false;
    }

    // Build list of players who need substitution (errored out or quizzed out)
    const needsSub: { chair: TeamChair; index: number; reason: string }[] = [];
    chairs.forEach((chair: TeamChair | null, index: number) => {
      if (chair && chair.playerNumber) {
        const rosterEntry = this.getRosterEntry(team, chair.playerNumber);
        if (rosterEntry) {
          if (rosterEntry.errorOut) {
            needsSub.push({ chair, index, reason: 'errored out' });
          } else if (rosterEntry.quizOut) {
            // Quiz-out players should be substituted (they can still answer bonuses if subbed back in)
            needsSub.push({ chair, index, reason: 'quizzed out' });
          }
        }
      }
    });

    // For manual substitutions, always show the dialog
    // For auto-triggered subs (from quiz-out/error-out), only proceed if someone needs subbing
    if (needsSub.length === 0 && autoTrigger) {
      console.log('showSubstituteDialog: No players need substitution, returning early');
      return false;
    }

    console.log('showSubstituteDialog: Showing dialog', { needsSub, autoTrigger });

    // Prepare chair options
    const chairOptions: ChairOption[] = chairs.map((chair: TeamChair | null, index: number) => {
      if (!chair || !chair.playerNumber) {
        return {
          index,
          displayName: 'Empty',
          isEmpty: true,
          playerNumber: 0
        };
      }
      const rosterEntry = this.getRosterEntry(team, chair.playerNumber);
      let status = '';
      if (this.errorOutPlayers.has(chair.playerNumber) || rosterEntry?.errorOut) {
        status = '[ERRORED OUT]';
      } else if (this.quizOutPlayers.has(chair.playerNumber) || rosterEntry?.quizOut) {
        status = '[QUIZZED OUT]';
      }
      return {
        index,
        displayName: chair.name,
        isEmpty: false,
        status,
        playerNumber: chair.playerNumber
      };
    });

    // Prepare substitution options - fetch player names from database
    const subOptions: SubstitutionOption[] = [];
    for (const r of availableSubs) {
      let playerName = (r.nickname || r.name || '').trim();

      // If name not cached in roster, fetch from database
      if (!playerName) {
        const player = await this.dbService.getPlayer(r.playerNumber);
        if (player) {
          playerName = (player.nickname || player.name || '').trim();
        }
      }

      // Determine player status
      let status = '';
      const settings = this.matchState.matchSettings;
      const foulsToFoulOut = settings?.foulsToFoulOut || this.parms?.foulOutNum || 2;

      if (r.quizOut) {
        status = 'Quizzed Out';
      } else if (r.errorOut) {
        status = 'Errored Out';
      } else if (r.fouls >= foulsToFoulOut) {
        status = 'Fouled Out';
      }

      subOptions.push({
        playerNumber: r.playerNumber,
        displayName: playerName ? `#${r.playerNumber} ${playerName}` : `Player #${r.playerNumber}`,
        name: playerName || `Player #${r.playerNumber}`,
        status
      });
    }

    // Set up dialog state
    this.subDialogTeam = team;
    this.subDialogTeamName = teamName;
    this.subDialogChairs = chairOptions;
    this.subDialogAvailableSubs = subOptions;

    if (autoTrigger && needsSub.length > 0) {
      this.subDialogAutoChairIndex = needsSub[0].index;
      this.subDialogAutoReason = needsSub[0].reason;
    } else {
      this.subDialogAutoChairIndex = null;
      this.subDialogAutoReason = '';
    }

    // Show dialog and wait for result
    return new Promise<boolean>((resolve) => {
      this.subDialogResolve = resolve;
      this.showSubDialog = true;
    });
  }

  onSubDialogConfirm(event: { chairIndex: number; playerNumber: number }) {
    this.showSubDialog = false;
    const sub = this.subDialogAvailableSubs.find(s => s.playerNumber === event.playerNumber);
    if (sub) {
      this.performSubstitution(this.subDialogTeam, event.chairIndex, event.playerNumber, sub.name)
        .then(() => {
          if (this.subDialogResolve) {
            this.subDialogResolve(true);
            this.subDialogResolve = null;
          }
        });
    } else {
      if (this.subDialogResolve) {
        this.subDialogResolve(false);
        this.subDialogResolve = null;
      }
    }
  }

  onSubDialogCancel() {
    this.showSubDialog = false;
    if (this.subDialogResolve) {
      this.subDialogResolve(false);
      this.subDialogResolve = null;
    }
  }

  onSwapDialogConfirm(event: { chairIndex1: number; chairIndex2: number }) {
    this.showSubDialog = false;
    this.performChairSwap(this.subDialogTeam, event.chairIndex1, event.chairIndex2)
      .then(() => {
        if (this.subDialogResolve) {
          this.subDialogResolve(true);
          this.subDialogResolve = null;
        }
      });
  }

  private async performSubstitution(team: 1 | 2, chairIndex: number, newPlayerNumber: number, newPlayerName: string): Promise<void> {
    if (!this.matchState) {
      return;
    }

    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const oldChair = chairs[chairIndex];
    const oldPlayerName = oldChair?.name || 'Empty seat';

    // Update the chair
    chairs[chairIndex] = {
      playerNumber: newPlayerNumber,
      rosterPosition: chairIndex,
      name: newPlayerName,
      quizOut: false,
      errorOut: false,
      bonusOnly: false
    };

    // Record the substitution action
    if (this.currentQuestion) {
      await this.recordAction(`Sub: ${oldPlayerName} → ${newPlayerName}`, newPlayerNumber, 0);
    }

    this.quizState.setMatchState(this.matchState);
    alert(`Substitution: ${oldPlayerName} replaced by ${newPlayerName}`);
  }

  private async performChairSwap(team: 1 | 2, chairIndex1: number, chairIndex2: number): Promise<void> {
    if (!this.matchState) {
      return;
    }

    const chairs = team === 1 ? this.matchState.team1Chairs : this.matchState.team2Chairs;
    const chair1 = chairs[chairIndex1];
    const chair2 = chairs[chairIndex2];

    if (!chair1 || !chair2) {
      alert('Cannot swap: one or both chairs are empty.');
      return;
    }

    const name1 = chair1.name;
    const name2 = chair2.name;

    // Swap the chairs by swapping their properties
    const tempChair = { ...chair1 };

    chairs[chairIndex1] = {
      playerNumber: chair2.playerNumber,
      rosterPosition: chairIndex1,
      name: chair2.name,
      quizOut: chair2.quizOut,
      errorOut: chair2.errorOut,
      bonusOnly: chair2.bonusOnly
    };

    chairs[chairIndex2] = {
      playerNumber: tempChair.playerNumber,
      rosterPosition: chairIndex2,
      name: tempChair.name,
      quizOut: tempChair.quizOut,
      errorOut: tempChair.errorOut,
      bonusOnly: tempChair.bonusOnly
    };

    // Record the swap action
    if (this.currentQuestion) {
      await this.recordAction(`Swap: ${name1} ↔ ${name2}`, chair1.playerNumber, 0);
    }

    this.quizState.setMatchState(this.matchState);
    alert(`Chair Swap: ${name1} (Chair ${chairIndex1 + 1}) ↔ ${name2} (Chair ${chairIndex2 + 1})`);
  }

  async onAppeal(team: 1 | 2) {
    if (team === 1) {
      if (this.matchState.team1Appeals <= 0) {
        alert(`${this.matchState.team1Team} has already used all of their appeals.`);
        return;
      }
      this.matchState.team1Appeals--;
      this.appealTeamName = this.matchState.team1Team;
    } else {
      if (this.matchState.team2Appeals <= 0) {
        alert(`${this.matchState.team2Team} has already used all of their appeals.`);
        return;
      }
      this.matchState.team2Appeals--;
      this.appealTeamName = this.matchState.team2Team;
    }

    // Get appeal duration from settings
    this.appealDuration = this.settings?.appealDurationSeconds || 90;

    this.quizState.setMatchState(this.matchState);

    // Show appeal dialog
    this.showAppealDialog = true;
  }

  onAppealComplete() {
    this.showAppealDialog = false;
  }

  async onEndMatch() {
    if (!confirm('This will end the match. Do you really want to end it?')) {
      return;
    }

    await this.endMatch();
  }

  async endMatch() {
    if (!this.matchState) return;

    // Save match summary
    const summary: MatchSummary = {
      quizID: this.matchState.quizID,
      matchID: this.matchState.matchID,
      team1: this.matchState.team1Team,
      team2: this.matchState.team2Team,
      score1: this.matchState.team1Score,
      score2: this.matchState.team2Score
    };

    await this.dbService.saveMatchSummary(summary);

    // Save player stats
    for (const roster of [...this.matchState.team1Roster, ...this.matchState.team2Roster]) {
      await this.dbService.saveMatchStats({
        playerNumber: roster.playerNumber,
        quizID: this.matchState.quizID,
        matchID: this.matchState.matchID,
        activeQuestions: roster.activeQuestions,
        correct: roster.correct,
        errors: roster.errors,
        fouls: roster.fouls,
        bonusCorrect: roster.bonusCorrect,
        bonusErrors: roster.bonusErrors
      });
    }

    // Show winner
    let winner = '';
    if (this.matchState.team1Score > this.matchState.team2Score) {
      winner = `${this.matchState.team1Team} wins! By a score of ${this.matchState.team1Score} to ${this.matchState.team2Score}.`;
    } else if (this.matchState.team2Score > this.matchState.team1Score) {
      winner = `${this.matchState.team2Team} wins! By a score of ${this.matchState.team2Score} to ${this.matchState.team1Score}.`;
    } else {
      winner = 'The match is tied!';
    }

    alert(`Congratulations! ${winner}`);

    // Check for tournament context and update tournament
    const tournamentContextStr = sessionStorage.getItem('tournamentContext');
    if (tournamentContextStr) {
      try {
        const tournamentContext = JSON.parse(tournamentContextStr);
        if (tournamentContext.tournamentId && tournamentContext.matchId) {
          await this.tournamentService.recordMatchResult(
            tournamentContext.tournamentId,
            tournamentContext.matchId,
            this.matchState.team1Score,
            this.matchState.team2Score,
            true // played locally
          );
          sessionStorage.removeItem('tournamentContext');
          this.quizState.resetMatch();
          this.router.navigate(['/tournament', tournamentContext.tournamentId]);
          return;
        }
      } catch (error) {
        console.error('Failed to update tournament:', error);
        sessionStorage.removeItem('tournamentContext');
      }
    }

    this.quizState.resetMatch();
    this.router.navigate(['/']);
  }

  startTimer() {
    this.stopTimer();
    this.timer = 0;
    this.timerWarn = false;
    this.timerExpired = false;
    this.timerActive = true;
    this.timerInterval = setInterval(() => {
      this.timer++;
      this.updateTimerThresholds();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timer = 0;
    this.timerActive = false;
    this.timerWarn = false;
    this.timerExpired = false;
  }

  getTimerDisplay(): string {
    if (this.timerExpired) {
      return 'TIME';
    }
    const minutes = Math.floor(this.timer / 60);
    const seconds = this.timer % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private updateTimerThresholds(): void {
    const settings = this.settings;
    if (!settings) {
      return;
    }
    if (!this.timerWarn && this.timer >= settings.speakWaitSeconds && settings.speakWaitSeconds > 0) {
      this.timerWarn = true;
    }
    if (!this.timerExpired && this.timer >= settings.answerTimeSeconds) {
      this.timerExpired = true;
      // Stop counting when time expires
      this.stopTimer();
      this.timerExpired = true; // Keep expired flag set even after stopping
      this.timerActive = true; // Keep timer visible
    }
  }

  getTeam1Color(): string {
    return this.quizState.getTeam1DarkColor();
  }

  getTeam2Color(): string {
    return this.quizState.getTeam2DarkColor();
  }

  onStartMatch() {
    this.router.navigate(['/select-question']);
  }

  getPlayerCorrect(team: 1 | 2, playerNumber: number): number {
    if (!this.matchState) {
      return 0;
    }
    const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
    const player = roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
    return player ? player.correct : 0;
  }

  getPlayerErrors(team: 1 | 2, playerNumber: number): number {
    if (!this.matchState) {
      return 0;
    }
    const roster = team === 1 ? this.matchState.team1Roster : this.matchState.team2Roster;
    const player = roster.find((r: TeamRoster) => r.playerNumber === playerNumber);
    return player ? player.errors : 0;
  }

  isPlayerFouled(playerNumber: number): boolean {
    return this.fouledPlayers.has(playerNumber);
  }

  // Flag question for review
  toggleFlagQuestion(): void {
    if (!this.currentQuestion) {
      return;
    }
    const questionID = this.currentQuestion.questionID;
    if (this.flaggedQuestions.has(questionID)) {
      this.flaggedQuestions.delete(questionID);
      console.log(`Question ${questionID} unflagged for review`);
    } else {
      this.flaggedQuestions.add(questionID);
      console.log(`Question ${questionID} flagged for review`);
    }
    // Persist flagged questions in session storage
    sessionStorage.setItem('flaggedQuestions', JSON.stringify([...this.flaggedQuestions]));
  }

  isQuestionFlagged(): boolean {
    if (!this.currentQuestion) {
      return false;
    }
    return this.flaggedQuestions.has(this.currentQuestion.questionID);
  }

  getFlaggedQuestionsCount(): number {
    return this.flaggedQuestions.size;
  }

  // Check if player is quiz-out (for display purposes)
  isPlayerQuizOut(playerNumber: number): boolean {
    return this.quizOutPlayers.has(playerNumber);
  }

  // Check if player is error-out (for display purposes)
  isPlayerErrorOut(playerNumber: number): boolean {
    return this.errorOutPlayers.has(playerNumber);
  }
}

