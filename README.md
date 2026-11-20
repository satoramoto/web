# Satoramoto

Company landing page for satoramoto. The public entry point uses Junction on the blue-and-gold Observatory scene. **Site / Satoramoto** in Storybook compares the published design with four other contact treatments.

| Story | What to look for |
| --- | --- |
| Junction | Two questions sit side by side. Select the blue **visionary** or gold **accelerator** to send a wave outward from that word and open its contact form. |
| Marginalia | Two questions stagger across the field, with raised role labels and detached arrow circles. The reference is [Elvina Prasad’s typographic navigation](https://elvinaprasad.com/). |
| Keybed | Two pressable keys in one housing, with fan-in and fan-out markings. Inspired by [teenage engineering’s Oplab hardware and port legends on Refero](https://refero.design/pages/20c66c64-a411-496f-a7ff-5153b8c900f0). |
| Contact Rows | A compact directory with one audience per row. |
| Quiet Pill | A role label above each standalone question button. |

Junction keeps the email and each role’s message in memory while the visitor changes paths. **open email draft** hands the selected role, reply address, and message to the visitor’s email app, addressed to `hello@satoramoto.com`. The static site does not submit or store the inquiry. Reduced motion opens the form immediately; WebGL is decorative and not required for either path.

- `npm ci` installs dependencies.
- `npm run dev` serves the site and its Storybook preview.
- `npm run build` builds the site into `dist/` for GitHub Pages.
- `npm run build-storybook` builds the standalone design previews.

GitHub Pages deploys on every push to the default branch of `satoramoto/web`, including pull request merges. To redeploy the same branch manually, use **Actions → Deploy website to GitHub Pages → Run workflow**. Other branches do not publish the site.

Junction submits on `satoramoto.com` through the separate Cloudflare Worker `satoramoto-contact` at `contact.satoramoto.com`. The Worker runs `worker/contact.mjs` with `CONTACT_EMAIL` (restricted to the verified inbox behind `hello@satoramoto.com`), `CONTACT_TO`, `TURNSTILE_SECRET`, and `CONTACT_RATE` bindings. Its `junction_contact` Turnstile widget is restricted to `satoramoto.com`. Keep the destination and secret in Cloudflare, not in the site build; the public widget key is in `src/site/main.tsx`. Run `npm run test:contact` before deploying Worker changes. The Storybook send states simulate mail and never contact the inbox.

The former band site lives in [ryangavin/funkadelic-astronaut-web](https://github.com/ryangavin/funkadelic-astronaut-web).
