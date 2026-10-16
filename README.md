# impactra-frontend
Frontend for IMPACTRA - Volunteer & NGO Impact Tracker

## Opportunity screens

Serve the repository over HTTP and open `pages/opportunities-list.html`. The six
opportunity pages load the root `API.js` before `pages/opportunities.js`. Shared
styles are in `pages/opportunities.css`; no build step is needed.

The creation flow keeps `impactraOpportunityDraft` across steps, creates a server
record, and publishes it before showing success. A failed publish retains its
server ID for retry. Confirmed publication uses `impactraPublishedOpportunity`
and an ID in the success/detail URLs. Listings render server records and use the
same IDs for detail links. Failed or missing API requests never report success.

These screens use the existing API client methods:

| Action | API client method |
| --- | --- |
| Create a record (multipart form data) | `API.organization.opportunities.create` |
| Update a saved draft | `API.organization.opportunities.update` |
| Publish | `API.organization.opportunities.publish` |
| List / get details | `API.opportunities.list` / `API.opportunities.get` |
| Apply | `API.volunteer.applications.submit` |

Creation and application require a signed-in account. The backend remains the
authority for role permissions, required profile fields, and validation.

## Regression checks

Use Node.js 20 or later:

```sh
npm ci
npx playwright install chromium
npm test
```

The suite runs real Chromium pages beneath `/impactra-frontend/`, covering draft
edits, publication and retry, missing/failed APIs, ID handling, application
submission, safe list rendering, search, mobile width, and local links. Requests
are mocked: the tests make no changes to the live backend and do not certify its
authenticated request schema. Confirm creation, publication, and application with
the team's test accounts before merging. For an existing compatible Chromium,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.
