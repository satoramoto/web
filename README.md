# Satoramoto

Company landing page for Satoramoto. The public entry point uses Interference. **Site / Satoramoto** in Storybook compares five contact treatments on the blue-and-gold Observatory scene.

| Story | What to look for |
| --- | --- |
| Junction | Hover or focus a question to power its circuit; select a role to send a wave from the chip and open its contact form. Inspired by the [V–A–C Foundation’s connected navigation](https://v-a-c.org/). |
| Marginalia | Two questions stagger across the field, with raised role labels and detached arrow circles. The reference is [Elvina Prasad’s typographic navigation](https://elvinaprasad.com/). |
| Keybed | Two pressable keys in one housing, with fan-in and fan-out markings. Inspired by [teenage engineering’s Oplab hardware and port legends on Refero](https://refero.design/pages/20c66c64-a411-496f-a7ff-5153b8c900f0). |
| Contact Rows | A compact directory with one audience per row. |
| Quiet Pill | A role label above each standalone question button. |

Junction keeps the email and each role’s message in memory while the visitor changes paths. **Open email draft** hands the selected role, reply address, and message to the visitor’s email app, addressed to `hello@satoramoto.com`. The static site does not submit or store the inquiry. Reduced motion opens the form immediately; WebGL is decorative and not required for either path.

- `npm ci` installs dependencies.
- `npm run dev` serves the site and its Storybook preview.
- `npm run build` builds the site into `dist/` for GitHub Pages.
- `npm run build-storybook` builds the standalone design previews.

GitHub Pages deploys on every push to the default branch of `satoramoto/web`, including pull request merges. To redeploy the same branch manually, use **Actions → Deploy website to GitHub Pages → Run workflow**. Other branches do not publish the site.

The former band site lives in [ryangavin/funkadelic-astronaut-web](https://github.com/ryangavin/funkadelic-astronaut-web).
