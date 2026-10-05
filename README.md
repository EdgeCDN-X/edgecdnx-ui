# Edgecdn

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.5.

## Health check profiles

Each project has **Locations > Health Check Profiles** for listing, creating,
editing, and deleting profiles. Profiles support TCP, HTTP/HTTPS (type `HTTP`
with protocol `https`), and static `ASSUME` probes. At least one uniquely named
probe is required. Interval and timeout values use Go duration syntax, such as
`30s` or `1m30s`; leaving them blank uses the health checker's defaults.
The IP stack defaults to **Dual**. The editor offers Dual, IPv4, and IPv6,
without an implicit "Default" option. Existing explicit stack settings are preserved;
omitted or empty stacks become Dual when edited and saved.

The API exposes `GET`/`POST /project/:project-id/healthcheckprofiles` and
`GET`/`PATCH`/`DELETE /project/:project-id/healthcheckprofiles/:profile-id`.
Create DTOs contain `name` and `probes`; update DTOs contain optional `probes`.
PATCH preserves omitted probes and replaces supplied probes. Profile labels
are not configurable; requests containing `labels` are rejected. Creates and
updates set only the automatically managed `edgecdnx.com/tenant` label.
Responses are Kubernetes HealthCheckProfile objects
(or an array for listing); delete returns 204. The server manages the
`edgecdnx.com/tenant` label and isolates access to the owning project.
Authorization uses the `healthcheckprofile` resource with `read`, `create`,
`update`, and `delete` actions.

Location node-group editors show a health check profile dropdown next to the
group name, outside the collapsed advanced configuration. It contains only profiles with the
current project's tenant label. Select **None** to clear a reference. Missing or
foreign node-group references must be replaced or cleared before saving.
Node editors suggest project profile names while still allowing manual references.
Before deleting a profile, remove its references from locations and nodes.

The location details page refreshes live healthcheck results every 30 seconds.
Each request resolves the current profiles (node references override node-group
references) and shows only results matching an active probe's name, type, and
target. Removed probes, obsolete targets, and removed nodes no longer affect the
displayed node health. Nodes without matching results show **No data**. Profile
lookup failures are displayed as errors rather than returning unfiltered history.

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

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
