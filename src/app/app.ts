import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ActionFeedbackHostComponent } from './shared/components/action-feedback/action-feedback-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ActionFeedbackHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
