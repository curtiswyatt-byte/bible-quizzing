import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-player-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-entry.component.html',
  styleUrl: './player-entry.component.css'
})
export class PlayerEntryComponent implements OnInit {
  players: Player[] = [];
  filteredPlayers: Player[] = [];
  selectedPlayer: Player | null = null;
  isNewPlayer = false;
  
  playerNumber: number | null = null;
  name: string = '';
  nickname: string = '';
  ageGroup: string = '';
  team: string = ' ';

  searchTerm: string = '';

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadPlayers();
  }

  async loadPlayers() {
    this.players = await this.dbService.getAllPlayers();
    this.players.sort((a, b) => a.playerNumber - b.playerNumber);
    this.filteredPlayers = [...this.players];
  }

  async onPlayerNumberChange() {
    if (this.playerNumber === null || this.playerNumber === 0) {
      // Auto-suggest next player number
      if (this.players.length > 0) {
        const maxNumber = Math.max(...this.players.map(p => p.playerNumber));
        this.playerNumber = maxNumber + 1;
      } else {
        this.playerNumber = 1;
      }
      this.isNewPlayer = true;
      this.clearForm();
      return;
    }

    const player = await this.dbService.getPlayer(this.playerNumber);
    if (player) {
      this.selectedPlayer = player;
      this.isNewPlayer = false;
      this.name = player.name;
      this.nickname = player.nickname;
      this.ageGroup = player.ageGroup;
      this.team = player.team;
    } else {
      this.isNewPlayer = true;
      this.clearForm();
    }
  }

  onNameFocus() {
    // If player number is blank when user starts entering name, auto-assign number
    if (this.playerNumber === null || this.playerNumber === 0) {
      this.onPlayerNumberChange();
    }
  }

  clearForm() {
    this.name = '';
    this.nickname = '';
    this.ageGroup = '';
    this.team = ' ';
    this.selectedPlayer = null;
  }

  async onAccept() {
    if (!this.playerNumber || this.playerNumber <= 0) {
      alert('Please enter a valid player number');
      return;
    }

    if (!this.name.trim()) {
      alert('Player name is required');
      return;
    }

    const player: Player = {
      playerNumber: this.playerNumber,
      name: this.name.trim(),
      nickname: this.nickname.trim() || ' ',
      ageGroup: this.ageGroup.trim() || ' ',
      team: this.team.trim() || ' '
    };

    try {
      await this.dbService.addPlayer(player);
      await this.loadPlayers();
      this.onCancel();
      alert('Player saved successfully!');
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Error saving player. Please try again.');
    }
  }

  onCancel() {
    this.playerNumber = null;
    this.clearForm();
    this.isNewPlayer = false;
    this.selectedPlayer = null;
  }

  async onDeletePlayer(playerNumber: number) {
    if (!confirm('Do you wish to delete this player from the system?')) {
      return;
    }

    try {
      await this.dbService.deletePlayer(playerNumber);
      // Also remove from teams
      const teams = await this.dbService.getAllTeams();
      for (const teamName of teams) {
        const members = await this.dbService.getTeamMembers(teamName);
        if (members.includes(playerNumber)) {
          await this.dbService.removeTeamMember(teamName, playerNumber);
        }
      }
      await this.loadPlayers();
      this.onCancel();
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Error deleting player. Please try again.');
    }
  }

  onPlayerClick(player: Player) {
    this.playerNumber = player.playerNumber;
    this.onPlayerNumberChange();
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredPlayers = [...this.players];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredPlayers = this.players.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.nickname.toLowerCase().includes(term) ||
      p.playerNumber.toString().includes(term)
    );
  }

  onReturn() {
    this.router.navigate(['/']);
  }
}





