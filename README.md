# DropYard

DropYard is a free remnant-metal board for machine shops. A shop lists leftover bar, plate, tube, sheet, round, or block. Nearby shops search by material, alloy, form, price, and distance from a ZIP code, then message the seller in the app and pick the metal up. Nothing is charged on the site.

Example listings around San Diego are seeded so the board is usable on first run. They are marked **Example** and are not live inventory.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

No environment variables are required. Listings are stored in `data/dropyard.db` (SQLite via libSQL). Uploaded photos go in `data/uploads/` and are served from `/uploads/...`.

```bash
npm test
npm run lint
npm run build
```

Delete `data/dropyard.db` and restart to load the example listings again. Set `SEED_EXAMPLE_DATA=false` before the first boot if you want an empty board.

## Example shops

Every seeded shop uses the password `dropyard-demo`.

| Shop | Email | ZIP |
| --- | --- | --- |
| Kearny Mesa Tool & Die | kearny@demo.dropyard.example | 92111 |
| Mira Mesa Aero Cuts | mira@demo.dropyard.example | 92126 |
| Harbor Stainless | harbor@demo.dropyard.example | 91910 |
| National City Marine Fab | marine@demo.dropyard.example | 91950 |
| El Cajon Job Shop | elcajon@demo.dropyard.example | 92020 |
| Santee Weldments | santee@demo.dropyard.example | 92071 |
| North County Titanium | oceanside@demo.dropyard.example | 92054 |
| Carlsbad Screw Machine | carlsbad@demo.dropyard.example | 92008 |
| Escondido Metals | escondido@demo.dropyard.example | 92025 |
| Sorrento Plastics | sorrento@demo.dropyard.example | 92121 |
| Lemon Grove Chassis | lemon@demo.dropyard.example | 91945 |
| Vista Sheet Metal | vista@demo.dropyard.example | 92083 |
| Barrio Logan Drops | barrio@demo.dropyard.example | 92113 |
| Old Town Precision | oldtown@demo.dropyard.example | 92110 |

Sign in as one of those shops to mark an example listing sold or to read a message you sent it. Create your own account for real listings.

## Environment variables

Copy `.env.example` to `.env.local` only when you need something other than the defaults.

| Variable | Required | Purpose |
| --- | --- | --- |
| `LIBSQL_URL` | On Vercel | libSQL URL. Turso URLs look like `libsql://your-db.turso.io`. `TURSO_DATABASE_URL` and `DATABASE_URL` are aliases. `DATABASE_URL` must be `libsql://` or `file:`, not Postgres. |
| `LIBSQL_AUTH_TOKEN` | With a remote URL | Database token. `TURSO_AUTH_TOKEN` is an alias. |
| `SEED_EXAMPLE_DATA` | No | Set to `false` before the first request to skip the San Diego examples. |
| `STORAGE_PROVIDER` | No | `local` (default) or `blob`. |
| `BLOB_READ_WRITE_TOKEN` | For blob photos | Vercel Blob token. If this is set and `STORAGE_PROVIDER` is empty, photos use Blob. |

When `LIBSQL_URL` is unset, the app uses `file:./data/dropyard.db`. A `file:` URL is also accepted for a different local path.

## Deploy on Vercel

The app is a Next.js App Router project and stays on the Node.js runtime. The Hobby (free) plan is enough. You still need a remote database because Vercel’s filesystem is ephemeral, so the local SQLite file will not keep listings.

1. Push this project to a Git host and import it in Vercel.
2. Create a free [Turso](https://turso.tech) database:

   ```bash
   turso db create dropyard
   turso db show dropyard --url
   turso db tokens create dropyard
   ```

3. In the Vercel project, set:

   - `LIBSQL_URL` to the `libsql://` URL
   - `LIBSQL_AUTH_TOKEN` to the token

4. Optional photos that persist: create a Blob store in the Vercel dashboard (included on the free tier) and set `STORAGE_PROVIDER=blob` plus `BLOB_READ_WRITE_TOKEN`. Without Blob, listings still work, but photo upload is refused on Vercel so files are not written to a disk that disappears.
5. Optional: set `SEED_EXAMPLE_DATA=false` if the production board should start empty. If you leave it unset, the first request seeds the example San Diego listings into the empty Turso database.
6. Deploy. `npm run build` is the build command and Next.js is the framework preset.

Distance search does not call a geocoding API. Centroids for US ZIP codes ship in `data/zip-centroids.csv`.

## Auth and messages

Accounts are email plus password. Passwords are hashed with bcrypt. The session cookie is HTTP-only and only the hash of the session token is stored. No magic-link email is sent, so the app does not need an email provider.

“Message seller” writes into the in-app inbox. Reports are stored on the listing. There is no admin console and no payment flow.

## ZIP data

`data/zip-centroids.csv` comes from the [GeoNames](https://www.geonames.org/) postal code dataset and is used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See `data/ZIP_SOURCE.txt`.
