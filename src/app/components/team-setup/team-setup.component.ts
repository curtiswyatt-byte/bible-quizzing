import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-team-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-setup.component.html',
  styleUrl: './team-setup.component.css'
})
export class TeamSetupComponent implements OnInit {
  mode: 'create' | 'edit' | 'rename' = 'create';
  teams: string[] = [];
  players: Player[] = [];
  availablePlayers: Player[] = [];
  teamMembers: Player[] = [];
  
  teamName: string = '';
  selectedTeam: string = '';
  selectedPlayer: Player | null = null;

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTeams();
    await this.loadPlayers();
  }

  async loadTeams() {
    this.teams = await this.dbService.getAllTeams();
    this.teams.sort();
  }

  async loadPlayers() {
    this.players = await this.dbService.getAllPlayers();
    this.players.sort((a, b) => a.name.localeCompare(b.name));
    this.updateAvailablePlayers();
  }

  updateAvailablePlayers() {
    if (this.mode === 'edit' && this.selectedTeam) {
      // Filter out players already on this team
      this.availablePlayers = this.players.filter(p => 
        !this.teamMembers.some(tm => tm.playerNumber === p.playerNumber)
      );
    } else {
      this.availablePlayers = [...this.players];
    }
  }

  onModeChange(mode: 'create' | 'edit' | 'rename') {
    this.mode = mode;
    this.teamName = '';
    this.selectedTeam = '';
    this.teamMembers = [];
    this.updateAvailablePlayers();
  }

  async onTeamSelect() {
    if (!this.selectedTeam) return;

    if (this.mode === 'rename') {
      const newName = prompt(`Enter new team name for "${this.selectedTeam}":`);
      if (newName && newName.trim()) {
        try {
          await this.dbService.renameTeam(this.selectedTeam, newName.trim());
          await this.loadTeams();
          alert('Team renamed successfully!');
          this.onModeChange('edit');
        } catch (error) {
          console.error('Error renaming team:', error);
          alert('Error renaming team. Please try again.');
        }
      }
      return;
    }

    if (this.mode === 'edit') {
      const memberNumbers = await this.dbService.getTeamMembers(this.selectedTeam);
      this.teamMembers = [];
      for (const num of memberNumbers) {
        const player = await this.dbService.getPlayer(num);
        if (player) {
          this.teamMembers.push(player);
        }
      }
      this.updateAvailablePlayers();
    }
  }

  async onPlayerSelect() {
    if (!this.selectedPlayer) return;

    // Check if player is already on a team (not empty or just whitespace)
    const currentTeam = this.selectedPlayer.team?.trim() || '';
    if (currentTeam !== '') {
      const confirmReassign = window.confirm(
        `${this.selectedPlayer.nickname || this.selectedPlayer.name} is already on ${currentTeam}. Do you wish to reassign?`
      );
      if (!confirmReassign) {
        this.selectedPlayer = null;
        return;
      }
    }

    // Check if already in current team members
    if (this.teamMembers.some(tm => tm.playerNumber === this.selectedPlayer!.playerNumber)) {
      alert('Player is already on the team.');
      this.selectedPlayer = null;
      return;
    }

    this.teamMembers.push(this.selectedPlayer);
    this.selectedPlayer = null;
    this.updateAvailablePlayers();
  }

  async onRemovePlayer(player: Player) {
    if (!confirm(`Do you wish to remove ${player.name} from the team?`)) {
      return;
    }

    this.teamMembers = this.teamMembers.filter(tm => tm.playerNumber !== player.playerNumber);
    this.updateAvailablePlayers();
  }

  async onTeamNameEnter() {
    if (!this.teamName.trim()) return;

    // Check if team already exists
    if (this.teams.includes(this.teamName.trim())) {
      alert('Team name already exists. Please enter another name.');
      this.teamName = '';
      return;
    }

    this.selectedTeam = this.teamName.trim();
    this.updateAvailablePlayers();
  }

  async onAccept() {
    if (this.mode === 'create') {
      if (!this.teamName.trim()) {
        alert('Please enter a team name');
        return;
      }
      this.selectedTeam = this.teamName.trim();
    }

    if (!this.selectedTeam) {
      alert('Please select or enter a team name');
      return;
    }

    try {
      // Remove existing team members if editing
      if (this.mode === 'edit') {
        const existingMembers = await this.dbService.getTeamMembers(this.selectedTeam);
        for (const num of existingMembers) {
          await this.dbService.removeTeamMember(this.selectedTeam, num);
        }
      }

      // Add new team members
      for (const player of this.teamMembers) {
        await this.dbService.addTeamMember(this.selectedTeam, player.playerNumber);
        // Update player's team
        player.team = this.selectedTeam;
        await this.dbService.addPlayer(player);
      }

      await this.loadTeams();
      alert('Team entry completed!');
      this.onCancel();
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Error saving team. Please try again.');
    }
  }

  onCancel() {
    this.mode = 'create';
    this.teamName = '';
    this.selectedTeam = '';
    this.teamMembers = [];
    this.selectedPlayer = null;
    this.updateAvailablePlayers();
  }

  onReturn() {
    if (this.teamMembers.length > 0) {
      if (confirm('Do you wish to accept the current team before returning to the main menu?')) {
        this.onAccept();
      }
    }
    this.router.navigate(['/']);
  }
}





