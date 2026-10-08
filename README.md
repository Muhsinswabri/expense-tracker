# Chelaveee

Personal income and expense tracker. React + Vite PWA, data in IndexedDB on your iPhone, with Apple Shortcuts that add transactions without opening the app.

```bash
npm install
npm run dev      # app only, http://localhost:5173
npm run build    # production build in dist/
```

## How Shortcuts work

A PWA can't register native Shortcuts actions. Only a native iOS app can do that. So Shortcuts call a small web endpoint instead:

```
Shortcut ──POST /api/add──▶ inbox (Upstash Redis) ──app opens──▶ IndexedDB
```

- **IndexedDB on the phone is the only source of truth.** The server inbox only holds Shortcut entries until the app picks them up.
- The app pulls the inbox when it opens, when it comes back to the foreground, and when it reconnects. It writes each entry to IndexedDB and only then deletes it from the inbox, so entries aren't lost if the app closes mid-sync.
- Duplicates are blocked twice:
  - The server rejects identical submissions within 30 s.
  - The app skips ids it already has.
- Everything else works offline. Only Shortcut sync needs the network.

A deep-link approach (Shortcut opens `app/?add=…`) was not used. iOS opens links in Safari, and Safari's storage is separate from the Home Screen app, so the entry would never reach your data.

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel. The Vite preset is detected automatically.
2. **Storage → Marketplace → Upstash (Redis)**: create a free database and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Settings → Environment Variables**: add `SHORTCUT_TOKEN` with a long random value, for example from `openssl rand -hex 24`. Redeploy.
4. On the iPhone, open the site in Safari, then **Share → Add to Home Screen**.
5. Open Chelaveee **from the Home Screen** and go to **Settings → Shortcuts → Key**. Paste the same `SHORTCUT_TOKEN`.

> Always use the Home Screen app. Its storage is separate from Safari's. Export a JSON backup now and then from Settings.

To test the API locally, use `npx vercel dev` with the same env vars in `.env.local`.

## Building the Shortcuts

Create one shortcut per action in the Shortcuts app. Name it **Add Expense**, **Add Income** or **Add To Receive** so Siri can run it by name.

### Add Expense

1. **Ask for Input**: Number, prompt `Amount`
2. **Choose from List**: `Food, Travel, Education, Shopping, Bills, Health, Personal, Other`, prompt `Category`
3. **Ask for Input**: Text, prompt `Note` (you can leave it empty)
4. **Get Contents of URL**: `https://YOUR-APP.vercel.app/api/add`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR_KEY`
   - Request Body: **JSON**
     - `type` = `expense`
     - `amount` = *Provided Input* (step 1)
     - `category` = *Chosen Item*
     - `note` = *Provided Input* (step 3)
5. **Show Notification**: *Contents of URL*. The server replies with a line like `Added expense: ₹250 · Food`.

### Add Income

Same as Add Expense, with two changes:

- `type` = `income`
- The category list is `Freelance, Salary, Business, Other`

### Add To Receive

Same as Add Income, with these changes:

- `type` = `to_receive`
- Before step 4, add **Ask for Input** (Date, prompt `Expected date`).
- Then add **Format Date** with Custom format `yyyy-MM-dd`.
- In step 4, add the JSON field `expectedDate` = *Formatted Date*.

### API reference

`POST /api/add` takes a JSON body. `GET /api/add?…` with query parameters also works.

| field | required | notes |
|---|---|---|
| `type` | yes | `expense`, `income`, `to_receive` |
| `amount` | yes | `250`, `1,250.50` and `₹250` are all accepted |
| `category` | no | Built-in names are matched case-insensitively. Other names (e.g. your custom `Gym`) are kept as given. Empty becomes `Other` |
| `note` | no | Up to 200 characters |
| `date` | no | Defaults to the day the Shortcut ran |
| `expectedDate` | no | For `to_receive`. Accepts `2026-10-15`, `15 Oct 2026` or `15/10/2026` |
| `id` | no | Your own id makes retries idempotent |

The key can be sent as `Authorization: Bearer …`, as a `key` field in the body, or as `?key=` in the URL.

Responses are plain text:

| status | meaning |
|---|---|
| `200` | Added |
| `400` | Invalid input; the text says why |
| `401` | Wrong key |
| `409` | Duplicate within 30 s |
| `500` | Server not set up |

## Data

Every transaction is stored in IndexedDB as:

```js
{ id, type: 'income' | 'expense' | 'to_receive', amount, category, date, expectedDate, note, status: 'received' | 'pending', createdAt }
```

- Marking a To Receive entry as received changes it to `income`, dated today.
- Balance = received income − expenses, for the selected period.
- To Receive entries are counted in the period of their expected date.

Settings has Export JSON, Export CSV, Import backup (merges by id) and Clear all data.

## Layout

```
api/            Vercel functions: add.js (Shortcuts), inbox.js (app sync)
shared/         Categories and validation used by both app and API
src/lib/        IndexedDB, totals and periods, backup, sync, formatting
src/components/ Sheet, form, rows, charts, settings
src/screens/    Home, Transactions, Insights
brand/          The official logo (brand/logo.png), source for all icons
scripts/        icons.mjs: builds icons and launch images from the logo
public/         Generated icons and iOS launch images
```

## Logo and icons

All icons come from one file. To change the logo:

1. Save the official logo as `brand/logo.png`. Use a square app-icon image, ideally 1024 px.
2. Run the icon script:

   ```bash
   npm run icons
   ```

3. Commit the files it updates in `public/`.

The script writes:

- the Home Screen icon (`apple-touch-icon.png`)
- the PWA icons, including a maskable one padded into the safe zone
- the favicon
- the small logo shown in the app header
- the iOS launch images

An opaque square logo is used edge to edge. iOS rounds the corners itself, so nothing inside the logo is cropped.
