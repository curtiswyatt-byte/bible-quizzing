import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/main-menu/main-menu.component').then(m => m.MainMenuComponent)
  },
  {
    path: 'player-entry',
    loadComponent: () => import('./components/player-entry/player-entry.component').then(m => m.PlayerEntryComponent)
  },
  {
    path: 'question-entry',
    loadComponent: () => import('./components/question-entry/question-entry.component').then(m => m.QuestionEntryComponent)
  },
  {
    path: 'team-setup',
    loadComponent: () => import('./components/team-setup/team-setup.component').then(m => m.TeamSetupComponent)
  },
  {
    path: 'match-setup',
    loadComponent: () => import('./components/match-setup/match-setup.component').then(m => m.MatchSetupComponent)
  },
  {
    path: 'match-settings',
    loadComponent: () => import('./components/match-settings/match-settings.component').then(m => m.MatchSettingsComponent)
  },
  {
    path: 'user-file',
    loadComponent: () => import('./components/user-file/user-file.component').then(m => m.UserFileComponent)
  },
  {
    path: 'data-library',
    loadComponent: () => import('./components/data-library/data-library.component').then(m => m.DataLibraryComponent)
  },
  {
    path: 'quiz-session',
    loadComponent: () => import('./components/quiz-session/quiz-session.component').then(m => m.QuizSessionComponent)
  },
  {
    path: 'select-question',
    loadComponent: () => import('./components/select-question/select-question.component').then(m => m.SelectQuestionComponent)
  },
  {
    path: 'select-teams',
    loadComponent: () => import('./components/select-teams/select-teams.component').then(m => m.SelectTeamsComponent)
  },
  {
    path: 'statistics',
    loadComponent: () => import('./components/statistics/statistics.component').then(m => m.StatisticsComponent)
  },
  {
    path: 'tournaments',
    loadComponent: () => import('./components/tournament-list/tournament-list.component').then(m => m.TournamentListComponent)
  },
  {
    path: 'tournament-setup',
    loadComponent: () => import('./components/tournament-setup/tournament-setup.component').then(m => m.TournamentSetupComponent)
  },
  {
    path: 'tournament/:id',
    loadComponent: () => import('./components/tournament-bracket/tournament-bracket.component').then(m => m.TournamentBracketComponent)
  },
  {
    path: 'data-import',
    loadComponent: () => import('./components/data-import/data-import.component').then(m => m.DataImportComponent)
  },
  {
    path: 'quiz-sets',
    loadComponent: () => import('./components/quiz-sets/quiz-sets').then(m => m.QuizSetsComponent)
  },
  {
    path: 'question-version-analyzer',
    loadComponent: () => import('./components/question-version-analyzer/question-version-analyzer').then(m => m.QuestionVersionAnalyzerComponent)
  },
  {
    path: 'database-explorer',
    loadComponent: () => import('./components/database-explorer/database-explorer').then(m => m.DatabaseExplorerComponent)
  },
  {
    path: 'print-questions',
    loadComponent: () => import('./components/print-questions/print-questions.component').then(m => m.PrintQuestionsComponent)
  },
  {
    path: 'match-history',
    loadComponent: () => import('./components/match-history/match-history.component').then(m => m.MatchHistoryComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
