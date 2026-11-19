# ClassManagementFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.16.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For the isolated Leave end-to-end suite, run:

```bash
npm run e2e
```

The Advertisement and Admin Password Reset suites use their own Playwright
configurations:

```bash
npm run e2e:advertisement
npm run e2e:admin-password-reset
```

These commands require their documented backend, credentials, and synthetic
fixture prerequisites; configuration selection alone does not mean that the
environment is ready to execute them.

Advertisement backend startup is documented in
`class-management-system/scripts/run-advertisement-browser-backend.sh` and
must use the `advertisement-browser-test` profile.

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
