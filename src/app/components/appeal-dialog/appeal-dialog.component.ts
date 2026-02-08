import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-appeal-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appeal-dialog.component.html',
  styleUrls: ['./appeal-dialog.component.css']
})
export class AppealDialogComponent implements OnInit, OnDestroy {
  @Input() teamName: string = '';
  @Input() durationSeconds: number = 90;
  @Output() completed = new EventEmitter<void>();

  timeRemaining: number = 0;
  private timerInterval: any = null;

  ngOnInit() {
    this.timeRemaining = this.durationSeconds;
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.stopTimer();
        this.completed.emit();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getTimerDisplay(): string {
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  endAppeal() {
    this.stopTimer();
    this.completed.emit();
  }
}
