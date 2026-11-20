# Satoramoto

Company landing page for Satoramoto. The public entry point uses Interference. **Site / Satoramoto** in Storybook compares five contact treatments on the blue-and-gold Observatory scene. Each offers the same two email links.

| Story | What to look for |
| --- | --- |
| Junction | Follow either trace from the die to its destination; hover or keyboard focus lights that route. Inspired by the [V–A–C Foundation’s connected navigation](https://v-a-c.org/). |
| Marginalia | Two questions stagger across the field, with raised role labels and detached arrow circles. The reference is [Elvina Prasad’s typographic navigation](https://elvinaprasad.com/). |
| Keybed | Two pressable keys in one housing, with fan-in and fan-out markings. Inspired by [teenage engineering’s Oplab hardware and port legends on Refero](https://refero.design/pages/20c66c64-a411-496f-a7ff-5153b8c900f0). |
| Contact Rows | A compact directory with one audience per row. |
| Quiet Pill | A role label above each standalone question button. |

- `npm ci` installs dependencies.
- `npm run dev` serves the site and its Storybook preview.
- `npm run build` builds the site into `dist/` for GitHub Pages.
- `npm run build-storybook` builds the standalone design previews.

GitHub Pages deployment is manual and only runs from the default branch of `satoramoto/web`. Pushing or merging does not publish the site.

The former band site lives in [ryangavin/funkadelic-astronaut-web](https://github.com/ryangavin/funkadelic-astronaut-web).
