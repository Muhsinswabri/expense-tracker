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
- The app pulls the inbox when it opens, when it is focused or comes back to the foreground, when it reconnects, and every 15 s while it is visible. It writes each entry to IndexedDB and only then deletes it from the inbox, so entries aren't lost if the app closes mid-sync.
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

Every shortcut asks for the amount and for a category from a list. There is no default category: cancelling either prompt stops the shortcut and nothing is saved.

### Add Expense

1. **Ask for Input**: Number, prompt `Amount`
2. **Choose from List**: `Food, Travel, Education, Shopping, Bills, Health, Personal` (add your own custom categories as extra items), prompt `Category`
3. **Ask for Input**: Text, prompt `Note` (you can leave it empty)
4. **Format Date**: *Current Date*, Custom format `yyyyMMdd-HHmmssSSS`
5. **Random Number**: between `1000` and `9999`
6. **Text**: `sc-` + *Formatted Date* + `-` + *Random Number*. This is the transaction id. Build it once, before the request, so a retry reuses it and is never saved twice. It must be 6–64 letters, digits, `-` or `_`. Shortcuts has no built-in UUID action; any UUID you generate also works.
7. **Get Contents of URL**: `https://YOUR-APP.vercel.app/api/add`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR_KEY`
   - Request Body: **JSON**
     - `id` = *Text* (step 6)
     - `type` = `expense`
     - `amount` = *Provided Input* (step 1)
     - `category` = *Chosen Item* (step 2)
     - `note` = *Provided Input* (step 3)
8. **Show Notification**: *Contents of URL*. The server replies with a line like `Added expense: ₹250 · Food`, or says why it refused (for example `Not added: Amount must be a number above 0.`).

### Add Income

Same as Add Expense, with two changes:

- `type` = `income`
- The category list is `Freelance, Salary, Business` (plus your custom income categories)

### Add To Receive

Same as Add Income, with these changes:

- `type` = `to_receive`
- The category list is `Freelance, Salary, Business, Borrowed Money` (plus your custom ones). `Borrowed Money`: once received it raises the balance but is not counted as income. Repay it with a normal expense.
- Before step 7, add **Ask for Input** (Date, prompt `Expected date`).
- Then add **Format Date** with Custom format `yyyy-MM-dd`.
- In step 7, add the JSON field `expectedDate` = *Formatted Date*.

### API reference

`POST /api/add` takes a JSON body. `GET /api/add?…` with query parameters also works, but it puts the transaction in the URL, so use POST.

| field | required | notes |
|---|---|---|
| `type` | yes | `expense`, `income`, `to_receive` |
| `amount` | yes | `250`, `1,250.50` and `₹250` are all accepted |
| `category` | no | Built-in names are matched case-insensitively. Other names (e.g. your custom `Gym`) are kept as given. The Shortcuts above always send one; an empty value becomes `Other` |
| `note` | no | Up to 200 characters |
| `date` | no | Defaults to the day the Shortcut ran |
| `expectedDate` | no | For `to_receive`. Accepts `2026-10-15`, `15 Oct 2026` or `15/10/2026` |
| `id` | no | 6–64 characters of `A–Z a–z 0–9 _ -`. Your own id makes retries idempotent. Identical entries with different ids are all kept |

Send the key as `Authorization: Bearer …`. A `key` field in the body or a `?key=` in the URL is still accepted for old shortcuts, but URLs end up in logs and history, so do not use them.

Responses are plain text:

| status | meaning |
|---|---|
| `200` | Added |
| `400` | Invalid input; the text says why |
| `401` | Wrong key |
| `409` | Duplicate within 30 s |
| `500` | Server not set up |

## Back Tap

Back Tap runs a shortcut when you tap the back of the iPhone. It needs no app to be open.

1. Build **Add Expense** and **Add Income** as above and run each once from the Shortcuts app to check it.
2. Open **Settings → Accessibility → Touch → Back Tap**.
3. **Double Tap** → scroll to **Shortcuts** → **Add Expense**.
4. **Triple Tap** → scroll to **Shortcuts** → **Add Income**.

Tap twice or three times on the back of the phone, enter the amount, pick the category. The notification confirms the save. The entry shows up in Chelaveee within 15 s if it is open, or the next time you open it.

## Data

Every transaction is stored in IndexedDB as:

```js
{ id, type: 'income' | 'expense' | 'to_receive', amount, category, date, expectedDate, note, status: 'received' | 'pending', createdAt }
```

- Marking a To Receive entry as received changes it to `income`, dated today.
- Balance = received income + received Borrowed Money − expenses, for the selected period. Total Income and the income breakdown leave Borrowed Money out.
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

1. Save the official logo as `brand/logo.png` (the current file is the official Chelaveee logo).
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
