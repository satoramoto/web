# AGENTS.md

How to work in this repo: where things go, which tests to run, what CI runs and what a review checks. The [README](README.md) explains the project.

## Where things go

| Folder | What it is | Storybook title |
| --- | --- | --- |
| `src/site/` | The public site, funkadelicastronaut.com: `main.tsx`, `PressKit/` | **Site / ...** (e.g. Site / Press Kit) |
| `src/experience/` | The desk experience, Storybook only, plus the separate `/museum/` POC in `TreeMuseum/`: `Arrival/`, `Desk/`, `Poster/`, `sections/`, `experiments/`, `debug/` | **Experience / ...** |
| `src/content/` | Band data as TypeScript (links, members, releases, live set, stages) and `locales/en.json`, the copy catalogue. No CSS, no components. | — |
| `src/components`, `src/behaviors`, `src/foundations`, `src/styles`, `src/geometry` | Shared library | **Library / Components / 2D/...**, **Library / Components / 3D/...**, **Library / Foundations / ...** |
| `legacy/` | The old vanilla-JS poster with its scripts, styles and `legacy/tests/`; kept, not deployed, not served by `npm run dev` | — |
| `assets/` | Images, fonts, audio and video; copied whole into `dist/` by `scripts/copy-static-build.cjs` because the site loads some files by fixed `/assets/...` URL | — |
| `docs/` | Design notes; the experience is in `docs/experience.md` | — |

Rules:

1. **Import direction.** `src/site` never imports from `src/experience`. Anything both need goes in `src/content` or the library. Library components should not import from `src/site` or `src/experience` (some library stories borrow experience scenes, such as the desk, for their "On desk" previews).
2. **Copy catalogue.** New user-visible site text goes in `src/content/locales/en.json` and is read with `t('section.key')` or, for inline `<span>`/`<strong>`/`<em>`, `<Copy k="section.key" />` from `src/i18n/copy.tsx`, never written inline in a component. English only, no i18n library; keys are type-checked by `tsc`, so a missing or misspelt key fails the build.
3. **Storybook titles** start with `Site/`, `Experience/` or `Library/` to match the folder the story's component lives in.
4. Nothing new goes in `legacy/`; it is kept for reference only.

## Tests and when to run them

| Command | What it checks | Run it when |
| --- | --- | --- |
| `node --test tests/<file>.test.cjs` | One Node test file | While working, for the area you touched |
| `npx vitest --project=storybook --run <path/to/X.stories.tsx>` | One story file's play functions in headless Chromium | While working on a component or story |
| `npx tsc --noEmit` | Types, including copy-catalogue keys | Fast check after TypeScript edits |
| `npm run test:legacy` | The legacy poster's Node tests (`cd legacy && node --test tests/*.test.cjs`) | After touching anything in `legacy/` |
| `npm test` | All Node tests in `tests/`, then `npm run test:legacy` | Once before pushing |
| `npm run build` | `tsc --noEmit`, the Vite build of the site, static copy | Once before pushing site or shared changes (it includes the `tsc` check, so skip the separate one) |
| `npm run build-storybook` | Storybook builds | Before pushing story or Storybook config changes |
| `npm run test:stories` | Every story as a browser test | Leave to CI unless you changed something many stories share |

Run each command once; don't run the full suites in overlapping configurations. Some `tests/*.browser.mjs` scripts need a running preview (`PREVIEW_URL=... node tests/<file>.browser.mjs`); see the doc for that area. `npm run dev` serves the site at `/` and Storybook at `/storybook/`; stop it when you are done.

## CI

- Pull requests (`.github/workflows/ci.yml`): `npm test` and `npm run build`; `npm run build-storybook`; `npm run test:stories`. CI on the PR is the final check.
- Pushes to `main` (`.github/workflows/pages.yml`): `npm test`, `npm run build`, then deploy `dist/` to GitHub Pages.

## PR review checklist

Flag real problems only, not style:

- Bugs: broken behaviour, wrong logic, regressions, accessibility failures (keyboard, labels, reduced motion), console errors.
- `src/site` importing from `src/experience`.
- User-visible site text written inline instead of in `src/content/locales/en.json`.
- Storybook titles outside `Site/`, `Experience/`, `Library/`, or not matching the folder.
- New behaviour without a test that would fail without it.
- Docs (`README.md`, `AGENTS.md`, `docs/`) left stale by the change.
- Placeholder tour dates or content presented as real.
