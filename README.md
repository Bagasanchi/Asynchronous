# Asynchronous

A browser card game for one or two people. In co-op, a friend claims the second seat through a private invitation. Players take turns controlling the same fighter through one encounter. The server saves every card and turn. A browser cookie identifies each seat, so players should return with the same browser profile. Clearing cookies loses access to that seat.

## Vercel and Supabase

[Play Asynchronous](https://asynchronous-beta.vercel.app).

The hosted game runs in the Guita team's Vercel project `asynchronous`. Its Seoul function stores matches, device subscriptions and reminder jobs in the Guba organization's Supabase project `Asynchronous`. The Docker version uses a separate local SQLite database.

To release an update, run `npm ci` and `npm test` from this directory. Link the checkout with `vercel link --project asynchronous --scope guita2`, then run `vercel deploy --prod --scope guita2`. Check the public `/health` endpoint and play a turn from an invitation in a second browser profile.

For a new database, apply the SQL in `supabase/migrations`, then set a strong password on the `asynchronous_game` login. Set these production environment variables in Vercel before deployment.

| Variable | Value |
| --- | --- |
| `GAME_DATABASE_URL` | Supabase transaction pooler URL on port 6543, with username `asynchronous_game.<project-ref>` and URL-encoded password. The function verifies the database TLS certificate. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | A stable Web Push key pair. Generate it once with `web-push`'s `generateVAPIDKeys()`. |
| `CRON_SECRET` | A random secret for Vercel's authenticated daily reminder retry. |

The function attempts push delivery after a handoff. Vercel Cron retries pending reminders daily. Keep production credentials in Vercel and use a separate database for preview testing.

## Run locally

From this directory, run `docker compose up --build -d` and open http://localhost:3000. Use another browser profile to try an invitation yourself. Localhost invitations only work on this computer. The lobby updates within eight seconds or when the tab regains focus.

For a native build, use Node 24 or newer, run `npm ci`, then `npm test` and `npm start`. The default address is 127.0.0.1:3000. Native saves go to the data directory. The release entry points are the root npm scripts.

## Deploy on one Linux server

1. Install Docker Engine with Compose, copy this project to the server, and point your domain's DNS to it. Allow inbound TCP 80 and 443. Keep any published IPv6 address routed to the same host.
2. Beside compose.yaml, create a file named `.env` with the public hostname. Set the optional VAPID subject to a real operator contact to enable turn reminders.

   ```dotenv
   GAME_DOMAIN=cards.example.com
   VAPID_SUBJECT=mailto:games@example.com
   ```

3. Run the following commands from this directory.

   ```sh
   docker compose -f compose.yaml -f compose.https.yaml up --build -d
   docker compose -f compose.yaml -f compose.https.yaml ps
   curl --fail https://cards.example.com/health
   ```

   Replace the example hostname with yours. Caddy provisions TLS, then proxies requests to the game. A healthy game answers with `{"ok":true}`. Open the public URL in two browser profiles, accept an invitation, play a card, end the turn, and reload the second profile. To check closed-tab reminders, opt in on that device before the other player ends their turn.

4. For updates, back up the database and rerun the same Compose up command with the new source. Keep the same Compose project name, game volume and hostname. For a rollback, redeploy the previous release and, when schema compatibility requires it, restore its matching backup. The app uses one process and one persistent volume. A host with ephemeral-only storage or multiple independent replicas will lose or split matches.

An existing HTTPS reverse proxy can use the base Compose file alone. Set `PUBLIC_ORIGIN` to the exact public HTTPS origin and forward requests to 127.0.0.1:3000. Set `GAME_PORT` to change the host-side port. Health is available without a player session. Inspect startup or delivery errors with `docker compose logs game`.

## Back up and restore

The game-data volume contains the board, seats and notification credentials. Store backups privately off the server. From a Linux shell in the project directory, run:

```sh
snapshot="asynchronous-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
docker compose exec -T game node scripts/backup.cjs "/tmp/$snapshot"
docker compose cp "game:/tmp/$snapshot" "./$snapshot"
```

The backup command takes a consistent live SQLite snapshot and checks its integrity. To restore into **a fresh volume** while preserving the original for rollback, choose a new Compose project name and a free local port. On Linux:

```sh
export COMPOSE_PROJECT_NAME=asynchronous-restored GAME_PORT=3100 PUBLIC_ORIGIN=http://localhost:3100
docker compose build game
docker compose run --rm --no-deps -v "$PWD/$snapshot:/restore.sqlite:ro" game node -e "require('node:fs').copyFileSync('/restore.sqlite','/data/tables.sqlite',require('node:fs').constants.COPYFILE_EXCL)"
docker compose up -d
curl --fail http://localhost:3100/health
```

Validate recent boards with their existing browser sessions before switching traffic. For public service use the original public hostname, HTTPS configuration and restored volume. Keep the old deployment stopped during cutover so the two copies cannot diverge.

## Release scope

Solo and invitation-only co-op are playable for one encounter. The default reminder is the in-game turn indicator. Optional Web Push uses the browser's push service. Browser permission, HTTPS (or localhost), and a supported device are required. This release has browser-bound seats and no billing, cross-device account recovery or matchmaking service.
