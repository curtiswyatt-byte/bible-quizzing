import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SubstitutionOption {
  playerNumber: number;
  displayName: string;
  name: string; // The actual name without player number prefix
  status?: string; // Quiz Out, Error Out, Foul Out status
}

export interface ChairOption {
  index: number;
  displayName: string;
  isEmpty: boolean;
  status?: string;
  playerNumber?: number; // Added for chair swap functionality
}

export type DialogMode = 'substitute' | 'swap';

@Component({
  selector: 'app-substitution-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './substitution-dialog.component.html',
  styleUrls: ['./substitution-dialog.component.css']
})
export class SubstitutionDialogComponent {
  @Input() teamName: string = '';
  @Input() chairs: ChairOption[] = [];
  @Input() availableSubs: SubstitutionOption[] = [];
  @Input() autoSubChairIndex: number | null = null; // If set, we're in auto-sub mode
  @Input() autoSubReason: string = '';
  @Output() confirmed = new EventEmitter<{ chairIndex: number; playerNumber: number }>();
  @Output() swapConfirmed = new EventEmitter<{ chairIndex1: number; chairIndex2: number }>();
  @Output() cancelled = new EventEmitter<void>();

  mode: DialogMode = 'substitute';
  selectedChairIndex: number | null = null;
  selectedPlayerNumber: number | null = null;

  // For swap mode
  swapChair1: number | null = null;
  swapChair2: number | null = null;

  ngOnInit() {
    console.log('SubstitutionDialog initialized:', {
      chairs: this.chairs,
      occupiedCount: this.getOccupiedChairsCount(),
      canSwap: this.canSwap(),
      autoSubChairIndex: this.autoSubChairIndex
    });
    if (this.autoSubChairIndex !== null) {
      this.selectedChairIndex = this.autoSubChairIndex;
    }
  }

  setMode(newMode: DialogMode) {
    this.mode = newMode;
    // Reset selections when switching modes
    this.selectedChairIndex = null;
    this.selectedPlayerNumber = null;
    this.swapChair1 = null;
    this.swapChair2 = null;
  }

  selectChair(index: number) {
    if (this.mode === 'substitute') {
      if (this.autoSubChairIndex === null) {
        this.selectedChairIndex = index;
      }
    } else if (this.mode === 'swap') {
      this.selectChairForSwap(index);
    }
  }

  selectChairForSwap(index: number) {
    const chair = this.chairs[index];
    if (chair.isEmpty) {
      return; // Can't swap an empty chair
    }

    if (this.swapChair1 === null) {
      this.swapChair1 = index;
    } else if (this.swapChair1 === index) {
      // Clicked same chair, deselect it
      this.swapChair1 = null;
    } else if (this.swapChair2 === null) {
      this.swapChair2 = index;
    } else if (this.swapChair2 === index) {
      // Clicked second chair, deselect it
      this.swapChair2 = null;
    } else {
      // Both selected, start fresh with this chair
      this.swapChair1 = index;
      this.swapChair2 = null;
    }
  }

  isSwapSelected(index: number): boolean {
    return this.swapChair1 === index || this.swapChair2 === index;
  }

  getSwapSelectionNumber(index: number): number | null {
    if (this.swapChair1 === index) return 1;
    if (this.swapChair2 === index) return 2;
    return null;
  }

  selectPlayer(playerNumber: number) {
    this.selectedPlayerNumber = playerNumber;
  }

  canConfirm(): boolean {
    if (this.mode === 'substitute') {
      return this.selectedChairIndex !== null && this.selectedPlayerNumber !== null;
    } else {
      return this.swapChair1 !== null && this.swapChair2 !== null;
    }
  }

  confirm() {
    if (this.mode === 'substitute' && this.canConfirm()) {
      this.confirmed.emit({
        chairIndex: this.selectedChairIndex!,
        playerNumber: this.selectedPlayerNumber!
      });
    } else if (this.mode === 'swap' && this.canConfirm()) {
      this.swapConfirmed.emit({
        chairIndex1: this.swapChair1!,
        chairIndex2: this.swapChair2!
      });
    }
  }

  cancel() {
    this.cancelled.emit();
  }

  getOccupiedChairsCount(): number {
    return this.chairs.filter(c => !c.isEmpty).length;
  }

  canSwap(): boolean {
    // Need at least 2 occupied chairs to swap
    return this.getOccupiedChairsCount() >= 2;
  }
}
