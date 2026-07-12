# Local scraper (Pararius, kamer.nl, Kamernet — and Facebook later)

These sources are Cloudflare/login-protected and only work reliably from a home (residential) IP,
so they run on your machine, not the GitHub cloud cron. HousingAnywhere runs 24/7 on the cloud.

## One-off run

```
cd ~/Projects/room-finder
npm run scrape:local
```

This builds and scrapes Kamernet + Pararius + kamer.nl (Facebook once configured), writing matches
to Supabase and alerting via Discord + push — exactly like the cloud, just from your IP.

## Run on a schedule (every 30 min while your machine is on)

### Option A — cron

`crontab -e`, then add (adjust the path and Node location; use `which node`):

```
*/30 * * * * cd $HOME/Projects/room-finder && /usr/bin/npm run scrape:local >> /tmp/room-finder-local.log 2>&1
```

### Option B — systemd user timer (survives across sessions)

`~/.config/systemd/user/roomfinder.service`:

```ini
[Unit]
Description=Room Finder local scrape
[Service]
Type=oneshot
WorkingDirectory=%h/Projects/room-finder
ExecStart=/usr/bin/npm run scrape:local
```

`~/.config/systemd/user/roomfinder.timer`:

```ini
[Unit]
Description=Run Room Finder local scrape every 30 min
[Timer]
OnBootSec=2min
OnUnitActiveSec=30min
Persistent=true
[Install]
WantedBy=timers.target
```

Enable: `systemctl --user daemon-reload && systemctl --user enable --now roomfinder.timer`
Check: `systemctl --user list-timers | grep roomfinder`

## Notes

- Playwright Chromium must be installed once: `pnpm --filter @rf/adapters exec playwright install chromium` (or `npx playwright install chromium`).
- These sources only refresh while your machine is running the timer/cron. Matches still alert to Discord + phone from local runs.
- `.env` (with your Supabase + Discord + VAPID keys) must exist at the repo root — it already does.
