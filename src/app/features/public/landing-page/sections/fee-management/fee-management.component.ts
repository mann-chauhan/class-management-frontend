import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-fee-management',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './fee-management.component.html',
  styleUrl: './fee-management.component.scss',
})
export class FeeManagementComponent {}
