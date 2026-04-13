# Bottabomma Monitor

A separate, lightweight monitoring portal for your Raspberry Pi bot.

It runs next to the bot instead of inside it, and reads:

- PM2 process status for the bot
- PM2 log files for recent output and errors
- Raspberry Pi CPU, RAM, disk, hostname, and uptime

## Why this setup

- No bot redeploy needed
- No frontend framework
- No external npm dependencies
- Works well on a Pi and on a phone screen

## Quick install on the Pi

From the project root on the Pi:

```bash
bash scripts/pi-monitor-setup.sh
```

At minimum, set:

```env
MONITOR_USERNAME=admin
MONITOR_PASSWORD=use-a-long-random-password
MONITOR_TARGET_NAME=bottabomma
```

Then open:

```text
http://127.0.0.1:3010
```

After you edit `monitor/.env`, rerun:

```bash
bash scripts/pi-monitor-setup.sh
```

If you want to reach it directly on your home network before adding a tunnel, set:

```env
MONITOR_HOST=0.0.0.0
```

Then open:

```text
http://<PI_IP>:3010
```

## ngrok recommendation

The simplest ngrok-based setup is:

1. Keep the monitor bound to `127.0.0.1`
2. Put ngrok in front of it
3. Keep dashboard basic auth enabled

The dashboard already has its own basic auth, so you do not need to add auth in ngrok unless you want a second layer.

Install ngrok on Raspberry Pi OS using ngrok's official guide:

- https://ngrok.com/docs/guides/device-gateway/raspbian/

Then link the agent to your account:

```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

Start the local monitor:

```bash
bash scripts/pi-monitor-setup.sh
```

Start ngrok under PM2:

```bash
bash scripts/pi-ngrok-setup.sh
```

That runs:

```bash
ngrok http 127.0.0.1:3010 --log stdout
```

The dashboard will also try to show the current ngrok public URL by querying ngrok's local agent API at `http://127.0.0.1:4040/api/tunnels`.

Useful commands:

```bash
pm2 logs bottabomma-ngrok --lines 100
curl http://127.0.0.1:4040/api/tunnels
pm2 restart bottabomma-ngrok
```

Note: on the free plan, ngrok's public URL usually changes when the tunnel restarts unless you have a reserved domain/subdomain.

## Useful PM2 commands

```bash
pm2 status
pm2 logs bottabomma --lines 100
pm2 logs bottabomma-monitor --lines 100
pm2 logs bottabomma-ngrok --lines 100
pm2 restart bottabomma-monitor
pm2 restart bottabomma-ngrok
```

## Config

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONITOR_HOST` | `127.0.0.1` | Bind only locally by default |
| `MONITOR_PORT` | `3010` | HTTP port |
| `MONITOR_USERNAME` | empty | Basic auth username |
| `MONITOR_PASSWORD` | empty | Basic auth password |
| `MONITOR_TARGET_NAME` | `bottabomma` | PM2 process name to inspect |
| `BOT_LOG_FILE` | empty | Fallback log file when not using PM2 |
| `MONITOR_LOG_LINES` | `120` | Lines to show in dashboard |
| `MONITOR_DISK_PATH` | `/` | Filesystem path checked by `df` |
| `NGROK_API_URL` | `http://127.0.0.1:4040/api/tunnels` | ngrok local API used to show the current public URL |

## Optional separate transfer

If you do not want to redeploy the whole project, create a small monitor-only tarball on your Mac:

```bash
bash scripts/build-monitor-bundle.sh
```

That produces `bottabomma-monitor.tar.gz`, which you can copy to the Pi and extract into the existing repo.
