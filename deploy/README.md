# Running Equis on a VPS

The contracts need no hosting; they are already on X Layer. This covers the two processes that do.

## What needs to run where

| Process | Where | Why |
| --- | --- | --- |
| `@EquisBot` | VPS | Long-running: polls Telegram and re-checks watched positions every 60s |
| Dashboard | VPS or Vercel | Either works. Telegram Mini Apps require https, so it needs a real certificate |
| Keeper | VPS | Must be awake when a position weakens |

## Setup

Node 24 or newer is required: the scripts are TypeScript and rely on node running `.ts` directly.

```bash
sudo adduser --system --group --home /opt/equis equis
sudo -u equis git clone https://github.com/NetLayerLabs/Equis.git /opt/equis
cd /opt/equis && sudo -u equis npm ci
```

Create `/opt/equis/.env.local`, readable only by the service user:

```bash
TELEGRAM_BOT_TOKEN=...            # from @BotFather
EQUIS_APP_URL=https://your.domain # optional, enables the Mini App button
```

```bash
sudo chown equis:equis /opt/equis/.env.local && sudo chmod 600 /opt/equis/.env.local
sudo cp deploy/equis-bot.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now equis-bot
journalctl -u equis-bot -f
```

## Dashboard on the same box

```bash
sudo -u equis npm run build
sudo cp deploy/equis-web.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now equis-web
```

Then put Caddy in front for TLS (see `Caddyfile`), pointing your domain at the VPS first.

## Security notes

The bot holds no private keys and signs nothing: it only reads the chain and sends messages. The only
secret on the box is the Telegram token, which is why the unit file restricts filesystem access and the
env file is `chmod 600`.

A keeper, if added later, WILL hold a key. Give it its own user, its own env file and an EIP-7702 session
key scoped to repay and top up collateral only, never a key that can withdraw.

## Updating

```bash
cd /opt/equis && sudo -u equis git pull && sudo -u equis npm ci
sudo systemctl restart equis-bot equis-web
```
