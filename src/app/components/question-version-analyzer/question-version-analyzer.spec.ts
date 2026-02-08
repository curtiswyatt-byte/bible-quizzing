import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionVersionAnalyzer } from './question-version-analyzer';

describe('QuestionVersionAnalyzer', () => {
  let component: QuestionVersionAnalyzer;
  let fixture: ComponentFixture<QuestionVersionAnalyzer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionVersionAnalyzer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionVersionAnalyzer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
