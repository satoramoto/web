# Repository guide

- The public entry point is `src/site/main.tsx`; landing-page variants are in `src/site/Landing/`.
- Keep user-visible React copy in `src/content/locales/en.json` and read it through `t()` in `src/i18n/copy.tsx`.
- Keep landing-page previews under `Site/Satoramoto` in Storybook.
- Run `npm run build` for site changes and `npm run build-storybook` for Storybook changes before pushing.
- Keep custom-domain and DNS changes separate from content changes.
