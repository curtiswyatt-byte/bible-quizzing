import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DirectDataLoaderService } from './services/direct-data-loader.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  title = 'XL Ministries Bible Quizzing';
  private dataLoader = inject(DirectDataLoaderService);

  async ngOnInit() {
    try {
      await this.dataLoader.initialize();
    } catch (error) {
      console.error('Dataset initialization failed:', error);
    }
  }
}
