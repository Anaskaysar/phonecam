# PhoneCam admin (local only)

Moderate ratings and testimonials from your own computer. This folder is in
`.gitignore`, so it is never pushed to GitHub, and the public site has no admin
page or admin API, so there is nothing on the internet to attack.

## Use it

From the project folder:

```bash
npx wrangler login              # once per computer, opens Cloudflare in your browser
node admin-local/server.mjs
```

Your browser opens `http://127.0.0.1:4545`. Press Ctrl+C in the terminal when you're done.

- **Waiting**: comments people asked to show. **Show on site** puts one on the home page.
- **On the site**: **Hide from site** takes one off again.
- **All ratings**: includes star-only and private ratings. **Delete** asks once more.

Each action runs Wrangler against the live D1 database, so it takes a few seconds.

## Why it's safe

- It listens on 127.0.0.1 only: other devices on your Wi-Fi can't reach it.
- Each start makes a new random key, and the link it prints carries it. Requests without the key, or not addressed to 127.0.0.1, are refused, so other websites open in your browser can't use it.
- It can only run three statements (show, hide, delete) on a rating id that must be a whole number.
- Comments are shown as text, never as HTML, so a nasty comment can't run code in this page.
- The real lock is your Cloudflare account: keep two-factor sign-in on.

## Try it without touching the live ratings

After `npm run test:e2e` has made the local test database:

```bash
PHONECAM_ADMIN_LOCAL=1 node admin-local/server.mjs
```

Back it up: this folder isn't in git, so copy it somewhere safe (or keep it in a private repo).
