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
updates set only the automatically managed `project` label.
Responses are Kubernetes HealthCheckProfile objects
(or an array for listing); delete returns 204. The server manages the
`project` label and isolates access to the owning project.
Authorization uses the `healthcheckprofile` resource with `read`, `create`,
`update`, and `delete` actions.

Location node-group editors show a health check profile dropdown next to the
group name, outside the collapsed advanced configuration. It contains only profiles with the
managed `project=<project-id>` label. Select **None** to clear a reference. Missing or
foreign node-group references must be replaced or cleared before saving.
Node editors suggest project profile names while still allowing manual references.
Before deleting a profile, remove its references from locations and nodes.
The location list and details page display all resource labels, including the
project label, as alphabetically sorted `key=value` badges. Locations without
labels display **No labels**.
On screens below the medium breakpoint (768px), the location list hides the
Node groups and Nodes columns. Labels are collapsed behind a clickable
three-dot button; opening it lists the labels vertically, and clicking it again
collapses them. Desktop labels remain on one line. Table cells do not wrap,
with horizontal scrolling when needed. Labels on the details page still wrap.
Click any label on either page to filter the location list. Filters use repeated
`label=key=value` query parameters, for example
`/projects/my-project/locations?label=region%3Deu&label=tier%3Dedge`.
A location must match **all** selected labels. Clicking an already selected
label removes that filter; active filter badges and **Clear filters** also
remove selections. Filters survive reloads, browser navigation, and visits to
location details. Filtering is applied to the project's loaded locations;
it does not change permissions or the resources available in the editor.
The Locations sidebar submenu stays expanded on filtered URLs and location
details; query parameters and fragments do not affect active menu matching.

The location details header uses icon badges for status, routing weight, node
group count, and configured fallback locations, with tooltips and screen-reader
labels. Badges wrap on smaller screens and status remains visible as text.

The location details page displays a GEO attributes section when
`spec.geoLookup.attributes` is non-empty. It lists attributes alphabetically,
their configured values, and any defined GEO, attribute, and value weights.
Locations without GEO attributes omit this section.

The location details page refreshes live healthcheck results every 30 seconds.
Each request resolves the current profiles (node references override node-group
references) and shows only results matching an active probe's name, type, and
target. Removed probes, obsolete targets, and removed nodes no longer affect the
displayed node health. Nodes without matching results show **No data**. Profile
lookup failures are displayed as errors rather than returning unfiltered history.

Healthcheck results include the database `source` field identifying the probing
location. Each check shows one combined chronological bar row by default. Expand
**Details** to see each source's status, history, duration, and latest failure.
The combined row keeps the latest 60 results across sources; each source keeps
its own latest 60 results within the requested window. A check (and its node) is
unhealthy if the latest result from any source is unhealthy. Older failures do
not override a source's newer successful result. Empty or NULL sources are
grouped as **Unknown source**. The database must have a `source` text column.
Hover over or keyboard-focus a result bar in either view to see a tooltip with
the check context, status, source, timestamp, start time (when available),
response code, duration in milliseconds, and message.

## DNS zone delegation

The New Zone modal and zone details page share guidance on delegating a whole
domain or a subzone. Zone details show this guidance below the title and
description, above the DNS records, with NS suggestions for the current zone.
Set `dnsNameservers` in the runtime configuration at `public/config/config.json`
(served as `config/config.json`) to a JSON array of nameserver hostnames:

```json
{
  "dnsNameservers": ["ns1.demo.edgecdnx.com"]
}
```

Configure the appropriate nameservers for each environment; the modal displays
every entry as an NS record below the email field. As users enter a valid Zone
Domain, the suggestions update to include that domain, for example
`random.mydomain.com NS ns1.demo.edgecdnx.com`.
If the array is missing or empty, it displays a
configuration warning instead of using demo nameservers.

For a whole domain, users must update the domain's nameservers at their registrar.
For a subzone, users must add an NS record for each configured nameserver under
the corresponding subzone in the parent domain's authoritative DNS settings
(at the registrar or current DNS provider), without changing the parent domain's
delegation. Creating a zone does not perform delegation or bypass DNS propagation.

## DNS record routing

The create/edit DNS record form supports Simple, Failover, Round Robin,
Weighted Round Robin (`Weighted`), and Geolocation policies. Simple uses
explicit record targets. Failover requires a primary location selected from
the current project's locations and submits its name as the target. Its
fallback chain is configured on the location, not the DNS record. Loading
failures, unavailable selections, and projects without locations block
Failover saves. Existing Failover records pre-select their primary location.
Round Robin, Weighted Round Robin, and
Geolocation instead require a `routeSelector.matchLabels` selector. The
`project=<project-id>` label is pre-filled, locked, and included in
every selector; additional labels narrow the selection of project locations.
Label keys must be unique and use Kubernetes label syntax. Match expressions
cannot be configured in this form; existing records using them are blocked
from selector-based saves rather than silently losing their expressions.

On the zone details page, clicking any routing label for a Geolocation,
Weighted, or Round Robin record opens the project's Locations page with
**all** of that record's match-label filters, including the project label.
Selectors containing match expressions remain non-clickable because the
location filters support match labels only.
Managed-service records also keep their routing labels non-clickable because
their locations are not visible to the user.

The zones API accepts the same policies, validates match-label selectors,
enforces the project label, and preserves routing configuration on
partial updates. An explicit switch to Simple or Failover clears the selector.

## OIDC session renewal

Authentication uses authorization code flow with PKCE and refresh-token renewal,
not hidden-iframe login. Configure the identity provider to issue refresh tokens
to this browser client, allow token-endpoint CORS from the UI origin, and enable
refresh-token rotation where supported. The runtime OIDC scope must include the
provider's required scope for refresh tokens (typically `offline_access`).

Access tokens renew at 75% of their lifetime. Scheduled renewal, tab-resume
checks, and API requests share one in-flight renewal. Requests to the configured
API receive the current token; a 401 triggers renewal and one retry, while 403
and unrelated errors retain their existing handling. OIDC endpoints and URLs
outside the configured API origin/path are excluded.

Missing refresh tokens, failed renewal, session termination, or a second 401
clear the local session and navigate to `/signin?redirectUrl=...`. Signing in
returns to that route. Logout still uses the identity provider's logout flow.
Initialization failures are logged and release route guards rather than leaving
the application waiting indefinitely.
Successful callback processing also releases route guards before awaiting the
post-login navigation. On the configured login callback URL, empty OIDC state
redirects the authenticated user to `/projects`. Normal page reloads retain
their path, query parameters, and fragment, even when OIDC state is present.

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
