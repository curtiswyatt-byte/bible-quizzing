import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizSets } from './quiz-sets';

describe('QuizSets', () => {
  let component: QuizSets;
  let fixture: ComponentFixture<QuizSets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizSets]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizSets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
