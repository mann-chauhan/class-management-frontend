import { Component } from '@angular/core';
import { AccessControlComponent } from './sections/access-control/access-control.component';
import { AcademicManagementComponent } from './sections/academic-management/academic-management.component';
import { BookDemoComponent } from './sections/book-demo/book-demo.component';
import { FeeManagementComponent } from './sections/fee-management/fee-management.component';
import { FooterComponent } from './sections/footer/footer.component';
import { HeroComponent } from './sections/hero/hero.component';
import { InstitutionCategoriesComponent } from './sections/institution-categories/institution-categories.component';
import { NavbarComponent } from './sections/navbar/navbar.component';
import { RoleExperiencesComponent } from './sections/role-experiences/role-experiences.component';
import { TeachingOperationsComponent } from './sections/teaching-operations/teaching-operations.component';
import { TrustedByComponent } from './sections/trusted-by/trusted-by.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    NavbarComponent,
    HeroComponent,
    InstitutionCategoriesComponent,
    AcademicManagementComponent,
    TeachingOperationsComponent,
    FeeManagementComponent,
    RoleExperiencesComponent,
    AccessControlComponent,
    BookDemoComponent,
    TrustedByComponent,
    FooterComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {}
