import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { UserFile } from '../../models/player.model';

@Component({
  selector: 'app-user-file',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-file.component.html',
  styleUrl: './user-file.component.css'
})
export class UserFileComponent implements OnInit {
  book: string = '';
  quizDBname: string = '';
  quizIDPre: string = '';
  quizIDNum: string = '';
  backupDrive: string = 'A';
  bookVersion: string = '';
  datasetId: string | null = null;

  bookOptions: string[] = [
    'James',
    'Titus',
    'Philippians',
    'Luke',
    'Matthew',
    'Mark',
    'Acts',
    'Romans',
    'Hebrews'
  ];

  versionOptions: string[] = [
    'NIV 1984',
    'ESV',
    'NASB',
    'NKJV',
    'KJV',
    'NIV 2011'
  ];

  constructor(
    private dbService: DatabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    const userFile = await this.dbService.getUserFile();
    if (userFile) {
      this.book = userFile.book;
      this.quizDBname = userFile.quizDBname;
      this.quizIDPre = userFile.quizIDPre;
      this.quizIDNum = userFile.quizIDNum;
      this.backupDrive = userFile.backupDrive;
      this.bookVersion = userFile.bookVersion || this.versionOptions[0];
      this.datasetId = userFile.datasetId ?? null;
    } else {
      this.bookVersion = this.versionOptions[0];
    }
  }

  async onAccept() {
    if (!this.book.trim()) {
      alert('Book name must be entered.');
      return;
    }
    if (!this.quizDBname.trim()) {
      alert('Database location must be entered.');
      return;
    }
    if (!this.quizIDPre.trim()) {
      alert('Quiz tournament name prefix must be entered.');
      return;
    }
    if (!this.quizIDNum.trim()) {
      alert('Quiz tournament number must be entered.');
      return;
    }

    const userFile: UserFile = {
      book: this.book.trim(),
      quizDBname: this.quizDBname.trim(),
      quizIDPre: this.quizIDPre.trim(),
      quizIDNum: this.quizIDNum.trim(),
      backupDrive: this.backupDrive,
      bookVersion: this.bookVersion.trim(),
      datasetId: this.datasetId ?? undefined
    };

    try {
      await this.dbService.saveUserFile(userFile);
      this.onCancel();
    } catch (error) {
      console.error('Error saving user file:', error);
      alert('Error saving configuration. Please try again.');
    }
  }

  onCancel() {
    this.router.navigate(['/']);
  }
}



