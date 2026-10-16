# impactra-frontend

Frontend for IMPACTRA — Volunteer & NGO Impact Tracker.

## Opportunity screens

Serve this repository over HTTP and open `pages/opportunities-list.html`.
No build step is needed. The six opportunity pages share
`pages/opportunity-workflow.js` and `pages/opportunities.css`, loading the root
`API.js` first. Inter is self-hosted in `assets/fonts/` with its license.

The opportunity review layout follows the supplied opportunity reference:
256px workspace sidebar, header search, three-step progress, Save/Publish bar,
basic-information and eligibility panels, milestone tasks, and a live draft
preview. The same visual styling is used across creation, listing, details and
publication confirmation. The sidebar becomes an accessible drawer on mobile.

The current form schema from `main` is preserved: cover image,
`volunteerCapacity`, structured `location`, `shifts`, `requirements` and `tasks`.
Service hours in the preview are calculated from the entered shifts. Optional
physical demands, task descriptions and task times are displayed when already
present in draft data; the current form does not collect them or invent values.
The reference image's example name, account photo and notification indicator
are not hardcoded. The signed-in account supplies the header identity.
Messaging and notifications have explicit unavailable notices because this
repository does not contain a messaging screen. Existing activity labels and
unrelated admin/onboarding screens are unchanged.

Drafts use `impactraOpportunityDraft` in session storage. Save draft keeps a
partial draft on this device; it does not create a server record. Back navigation
from the schedule step also preserves unfinished edits. Storage failures block
advancing and show an actionable error.

Publishing creates a multipart server record, retains its returned ID, and
publishes it before showing confirmation. Failed publication can retry the same
ID after a reload. Editing a created draft updates that record before retrying.
Confirmed publication uses `impactraPublishedOpportunity` and an ID in the URL.
A draft alone cannot produce a success screen. List/detail failures show errors
and retry controls; a URL ID never falls back to a different cached record.

These screens use the existing API client methods:

| Action                             | API client method                                  |
| ---------------------------------- | -------------------------------------------------- |
| Create a record (multipart)        | `API.organization.opportunities.create`            |
| Update a created draft (multipart) | `API.organization.opportunities.update`            |
| Publish                            | `API.organization.opportunities.publish`           |
| List / get details                 | `API.opportunities.list` / `API.opportunities.get` |
| Apply (volunteer accounts)         | `API.volunteer.applications.submit`                |

NGO detail views link to the existing applications workspace. Volunteer accounts
can apply using the existing volunteer endpoint. The backend remains the
authority for account roles, profile completeness and permissions. Lists retain
the existing request limit of 100, with a notice when that limit is reached.

## Regression checks

Use Node.js 20 or later:

```sh
npm ci
npx playwright install chromium
npm test
```

The 24 tests run real Chromium pages beneath `/impactra-frontend/`. They cover
the current multipart fields, file upload and storage failures, preserved drafts,
shift validation, review calculations, publishing and retry, editing created
drafts, guarded success, safe rendering, search/filtering, missing/failed APIs,
ID handling, volunteer applications, NGO actions, mobile drawer keyboard use,
375px/768px layouts, local fonts and asset paths. Each test checks for uncaught
JavaScript errors.

Requests are mocked: tests make no live backend changes and do not certify the
authenticated backend schema. Before merging, verify create, update, publish and
application submission with the team's test accounts. In particular, confirm
that the update endpoint accepts multipart cover-image edits. For an existing
compatible Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.
