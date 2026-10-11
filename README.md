# Funkadelic Astronaut

The public site is **https://funkadelicastronaut.com/**: the band's press kit, a newsprint-style EPK built in React. Its source is `src/site/` (`main.tsx` and `PressKit/`).

## Run it

```sh
npm install
npm run dev
```

This serves the site at http://127.0.0.1:4173/ and Storybook at http://127.0.0.1:4173/storybook/ from one origin, with hot reload. Ports, labels and running several worktrees side by side are covered in [docs/local-preview.md](docs/local-preview.md). Never use Python's HTTP server for the development preview. Test commands and when to run them are in [AGENTS.md](AGENTS.md).

## Tree of Life prototype

The independent `/museum/` entry is an immersive portfolio proof of concept. Three live Butterchurn presets fill a stable branching WebGL2 composition. Wheel, touch or arrow/Page keys move through a circular world; the project titles open accessible detail dialogs. Pause, reset and reduced-motion support are included. This silent demo uses synthetic audio samples, with no microphone or audio-device permissions. It does not change the band homepage. Implementation and rendering limits are in [docs/tree-museum.md](docs/tree-museum.md).

## How it deploys

Pushes to `main` run `.github/workflows/pages.yml`: `npm test` (which also runs the legacy poster's tests), then `npm run build` (which copies `assets/` alongside the bundle), then the built `dist/` is published to GitHub Pages (custom domain funkadelicastronaut.com, DNS at Namecheap). Built pages link their files relatively (`base: './'`), so the same build works at the domain root or any subpath. Pull requests run `.github/workflows/ci.yml`: `npm test` and `npm run build`, `npm run build-storybook`, and `npm run test:stories`.

## Where the copy lives

All press-kit text is in `src/content/locales/en.json`. Components read it through a small typed lookup in `src/i18n/copy.tsx` (`t()` for plain text, `<Copy>` for text with inline emphasis); the site is English only, and keys are type-checked by `tsc`. New user-visible site text goes in that catalogue, never inline in a component. Band data (links, members, releases, the live set, stages) is TypeScript in `src/content/`.

## Map of the repo

`src/site/` is what funkadelicastronaut.com serves (Storybook: **Site / Press Kit**). `src/experience/` is the interactive promoter's-desk experience, which lives only in Storybook (**Experience / ...**): the arrival, the desk, the React port of the old poster, its sections, experiments and debug benches; its long-form notes are in [docs/experience.md](docs/experience.md). `src/content/` is the band data and copy catalogue both use. `src/components`, `src/behaviors`, `src/foundations`, `src/styles` and `src/geometry` are the shared library (**Library / Components / 2D|3D** and **Library / Foundations**). `src/site` never imports from `src/experience`; anything both need goes in `src/content` or the library. `legacy/` is the original vanilla-JS poster (`classic.html`, `press-kit.html`, its scripts, styles and tests), kept but not deployed or served by `npm run dev`; `/classic.html` and `/press-kit.html` on the live site are noindex redirect stubs to `/` (`public/classic.html`, `public/press-kit.html`). `assets/` holds the images, fonts and media, and is copied whole into the build. Its notes are in [docs/legacy-poster.md](docs/legacy-poster.md). Other design notes are in `docs/`.

## Content and assets

- Official biography / photos: https://www.funkadelicastronaut.com/band
- Booking email: https://www.funkadelicastronaut.com/
- Current trio confirmed by https://funkadelicastronaut.bandcamp.com/
- Performance (legacy poster): official homepage Squarespace-hosted HLS video, duration 522 seconds. The stable playlist URL is requested on play; expiring segment URLs are never persisted. HLS.js (Apache 2.0, license in assets) loads only on demand, with native HLS as the fallback when Media Source Extensions are unavailable.
- Tour dates: never present placeholder details as announced shows. The Olive's and bowling-alley tour passes in the experience are sample/fictional data and are labelled as such; the September 26, 2026 Nyack Neighborhood Music & Arts Festival entry is user-verified and links to the organizer's Instagram schedule. Keep an empty state for when no real dates exist.
- Photos are genuine band media reused from the official site; no generated people. Photographer credits and high-resolution press downloads were not published with these assets. Contact the band for those materials.
- Fonts are served locally; see [docs/fonts.md](docs/fonts.md) for provenance and licences (SIL Open Font License, except Homemade Apple under Apache 2.0). Font specimens comparing Chicle, Modak and Shrikhand are preserved in `output/font-specimens.html`.
- Astronaut generated using built-in imagegen, then a transparency edit. See `output/astronaut-prompt.md`. Final web asset: `assets/astronaut.webp`.
- The approved concepts remain untouched in `output/epk-directions`. None are rendered by the website.
- Dependencies, secrets, and local `output/` design/QA references are excluded from Git.

Repository: https://github.com/ryangavin/funkadelic-astronaut-web
