# Impactra opportunity design update

Target branch: `feature/impactra-opportunity-fixes`
Repository: `Oly-stack/impactra-frontend`
Remote feature base: `76db6f0a36a1f36ec390df7ef5942507a7f90351`
Latest main included: `54b595ea48bb2e6824de5514753f4de6eeb4146b`
Completed local branch: `5bead81ffbb7e4ad8a522dfd68baa6a7b5a67e7c`

This ZIP replaces the earlier opportunity-fixes package. It contains 28
files that differ from your current remote feature branch, including the team's
newer main updates. Unrelated admin, signup and application changes are copied
unchanged from main. The new opportunity layout follows
`IMG-20261016-WA0035.jpg`. Main has not been modified remotely.

## Option 1 — Git (preserves the completed merge history)

Extract this ZIP. Open a terminal in your existing Impactra checkout. Use the
actual path to the extracted bundle in the first command. Keep local work saved
before switching branches.

```sh
git fetch "/path/to/extracted/opportunity-fixes.bundle" feature/impactra-opportunity-fixes
git switch feature/impactra-opportunity-fixes
git merge --ff-only FETCH_HEAD
git push origin feature/impactra-opportunity-fixes
```

The push uses your own GitHub authentication. If the fast-forward fails, stop
and reconcile newer branch work; do not force-push. This bundle contains the
already resolved merge with main and the complete tested design update.

## Option 2 — Upload the source files through GitHub

1. Extract the ZIP. Open the extracted `changed-files` folder.
2. In GitHub, open `Oly-stack/impactra-frontend` and select
   `feature/impactra-opportunity-fixes` in the branch selector.
3. Choose **Add file → Upload files**.
4. Select all contents inside `changed-files`, including `assets`, `pages` and
   `tests`, and drag them into the upload area. Do not upload the ZIP itself or
   the enclosing `changed-files` folder.
5. Commit to `feature/impactra-opportunity-fixes` with the message
   **Match opportunity screens to the review design**.

The browser upload copies the final files but does not transfer Git merge
history. GitHub may still show this branch behind main or require PR conflict
resolution. Option 1 preserves that history and the resolved main merge.
Never upload these changes directly to main.

## Validation and limits

- 24 Chromium browser checks passed with mocked API responses.
- Creation, image uploads, draft storage, shifts, review calculations, publishing,
  retry, filtering, detail IDs, volunteer applications and mobile navigation
  were checked. No uncaught JavaScript errors occurred in those checks.
- All six pages fit 375px and 768px viewports; desktop layouts were inspected.
- This package's patch was applied to an isolated Git index at the remote base
  and produced exactly the completed branch's source tree.
- The bundle was verified. No live backend records were created in testing.
- Before merging, use the team's test accounts to confirm the authenticated
  create, update, publish and apply endpoints. Multipart cover-image updates
  still need live backend validation.
- Physical demands and task descriptions/times are shown when existing draft
  data provides them; the current form schema does not collect those extras.
  Example data from the screenshot is not hardcoded into the app.
- Messaging/notifications show an unavailable notice because their screens are
  absent from this repository.

`opportunity-fixes.patch` is also provided for developers applying the final
file changes against the recorded remote base. `FILES-CHANGED.txt` lists every
source file included for upload. Run the checks using the repository README.
