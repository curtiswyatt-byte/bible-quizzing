import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../../services/database.service';
import { Tournament, TournamentStatus } from '../../models/tournament.model';

@Component({
  selector: 'app-tournament-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournament-list.component.html',
  styleUrl: './tournament-list.component.css'
})
export class TournamentListComponent implements OnInit {
  tournaments: Tournament[] = [];
  loading = true;
  showDeleteConfirm = false;
  tournamentToDelete: Tournament | null = null;

  constructor(
    private router: Router,
    private dbService: DatabaseService
  ) {}

  async ngOnInit() {
    await this.loadTournaments();
  }

  async loadTournaments() {
    this.loading = true;
    try {
      this.tournaments = await this.dbService.getAllTournaments();
      // Sort by updatedAt descending (most recent first)
      this.tournaments.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to load tournaments:', error);
      this.tournaments = [];
    }
    this.loading = false;
  }

  get inProgressTournaments(): Tournament[] {
    return this.tournaments.filter(t => t.status === 'in-progress');
  }

  get setupTournaments(): Tournament[] {
    return this.tournaments.filter(t => t.status === 'setup');
  }

  get completedTournaments(): Tournament[] {
    return this.tournaments.filter(t => t.status === 'completed');
  }

  getStatusLabel(status: TournamentStatus): string {
    switch (status) {
      case 'in-progress': return 'In Progress';
      case 'setup': return 'Setup';
      case 'completed': return 'Completed';
    }
  }

  getTypeLabel(type: string): string {
    return type === 'single-elimination' ? 'Single Elimination' : 'Double Elimination';
  }

  getMatchProgress(tournament: Tournament): string {
    let total = 0;
    let completed = 0;
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.team1Slot.type !== 'bye' && match.team2Slot.type !== 'bye') {
          total++;
          if (match.result) {
            completed++;
          }
        }
      }
    }
    return `${completed}/${total} matches`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  navigateToSetup() {
    this.router.navigate(['/tournament-setup']);
  }

  openTournament(tournament: Tournament) {
    this.router.navigate(['/tournament', tournament.tournamentID]);
  }

  confirmDelete(tournament: Tournament, event: Event) {
    event.stopPropagation();
    this.tournamentToDelete = tournament;
    this.showDeleteConfirm = true;
  }

  cancelDelete() {
    this.tournamentToDelete = null;
    this.showDeleteConfirm = false;
  }

  async deleteConfirmed() {
    if (this.tournamentToDelete) {
      await this.dbService.deleteTournament(this.tournamentToDelete.tournamentID);
      await this.loadTournaments();
    }
    this.cancelDelete();
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
