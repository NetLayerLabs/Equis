/**
 * @EquisBot: the Telegram side of Equis.
 *
 *   node scripts/telegram-bot.ts --check     verify the token and print the bot's name
 *   node scripts/telegram-bot.ts             run it (long polling, Ctrl-C to stop)
 *
 * Reads TELEGRAM_BOT_TOKEN from .env.local (or the environment). Optional EQUIS_APP_URL, which must be
 * https for Telegram to open it as a Mini App.
 *
 * Deliberately dependency-free: the Telegram Bot API is plain HTTP, and a bot framework would be one more
 * thing to break the night before a deadline. State is one JSON file next to this script.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, type Address } from "viem";
import { OKX_ADDRESS_URL, deployment } from "../src/lib/contracts.ts";
import { getMarketPrices, getPoolStats, getPosition } from "../src/lib/server/equisReads.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(resolve(root, ".env.local"));
} catch {
  // Environment may already carry the token.
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("Set TELEGRAM_BOT_TOKEN in .env.local (get one from @BotFather on Telegram).");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const APP_URL = process.env.EQUIS_APP_URL;
const STATE_PATH = resolve(root, "scripts/.telegram-watchlist.json");

/** Below this health factor a position is in danger; above the upper mark it is considered recovered. */
const ALERT_BELOW = 1.15;
const RECOVERED_ABOVE = 1.25;
const POLL_SECONDS = 60;

type Watch = { chatId: number; address: Address; alerted: boolean };
let watches: Watch[] = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : [];
const saveWatches = () => writeFileSync(STATE_PATH, JSON.stringify(watches, null, 2));

async function api(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${method}: ${body.description}`);
  return body.result;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

function keyboard() {
  const buttons = [];
  if (APP_URL?.startsWith("https://")) buttons.push([{ text: "Open Equis", web_app: { url: APP_URL } }]);
  buttons.push([{ text: "Vault on the explorer", url: `${OKX_ADDRESS_URL}${deployment.vault}` }]);
  return { inline_keyboard: buttons };
}

const send = (chatId: number, text: string) =>
  api("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(),
  });

// --- commands ----------------------------------------------------------------------------------

async function cmdStart(chatId: number) {
  await send(
    chatId,
    [
      "<b>Equis</b> - margin credit against tokenized stocks on X Layer.",
      "",
      "Deposit tokenized shares, borrow USD₮0, keep the upside.",
      "",
      "<b>Commands</b>",
      "/markets - live collateral prices",
      "/pool - lending pool and rates",
      "/position &lt;address&gt; - collateral, debt and health",
      "/watch &lt;address&gt; - alert me if its health factor falls",
      "/unwatch &lt;address&gt; - stop those alerts",
      "/watching - what I am watching for you",
    ].join("\n"),
  );
}

async function cmdMarkets(chatId: number) {
  const prices = await getMarketPrices();
  const lines = prices.map((price) =>
    price.priceUsd === null
      ? `${escape(price.symbol)}  no price`
      : `<code>${escape(price.symbol.padEnd(8))}</code> ${usd(price.priceUsd)}  <i>${escape(price.name)}</i>`,
  );
  await send(chatId, [`<b>Collateral markets</b>`, "", ...lines, "", "<i>Signed by RedStone, verified onchain.</i>"].join("\n"));
}

async function cmdPool(chatId: number) {
  const pool = await getPoolStats();
  await send(
    chatId,
    [
      "<b>USD₮0 lending pool</b>",
      "",
      `Supplied: ${usd(pool.supplied)} of ${usd(pool.supplyCap)} cap`,
      `Borrowed: ${usd(pool.borrowed)}`,
      `Utilisation: ${pct(pool.utilisation)}`,
      `Supply APY: ${pct(pool.supplyApy)}`,
      `Borrow APY: ${pct(pool.borrowApy)}`,
      `Available to withdraw now: ${usd(pool.cash)}`,
    ].join("\n"),
  );
}

function describePosition(address: Address, position: Awaited<ReturnType<typeof getPosition>>) {
  if (position.priceStale) {
    return [
      `<b>${escape(address)}</b>`,
      "",
      "The oracle has no fresh price right now, so this position cannot be valued.",
      "Prices refresh whenever anyone borrows, repays or liquidates.",
    ].join("\n");
  }

  const holdings = position.holdings.length
    ? position.holdings.map((h) => `${h.amount.toFixed(4)} ${escape(h.symbol)}`).join(", ")
    : "none";
  const health =
    position.healthFactor === null
      ? "no debt"
      : `${position.healthFactor.toFixed(2)}${position.healthFactor < 1 ? "  <b>LIQUIDATABLE</b>" : ""}`;

  return [
    `<b>${escape(address.slice(0, 10))}…${escape(address.slice(-6))}</b>`,
    "",
    `Collateral: ${usd(position.collateralUsd)} (${holdings})`,
    `Debt: ${usd(position.debtUsd)}`,
    `Borrow power: ${usd(position.borrowPowerUsd)}`,
    `Health factor: ${health}`,
    position.marketsOpen ? "Markets open" : "Markets closed - borrowing is paused",
  ].join("\n");
}

async function cmdPosition(chatId: number, arg?: string) {
  if (!arg || !isAddress(arg)) return send(chatId, "Send an address: <code>/position 0x…</code>");
  await send(chatId, describePosition(arg as Address, await getPosition(arg as Address)));
}

async function cmdWatch(chatId: number, arg?: string) {
  if (!arg || !isAddress(arg)) return send(chatId, "Send an address: <code>/watch 0x…</code>");
  const address = arg as Address;
  if (watches.some((w) => w.chatId === chatId && w.address.toLowerCase() === address.toLowerCase())) {
    return send(chatId, "Already watching that address.");
  }
  watches.push({ chatId, address, alerted: false });
  saveWatches();
  await send(
    chatId,
    `Watching <code>${escape(address)}</code>. I will message you if its health factor falls below ${ALERT_BELOW}.`,
  );
}

async function cmdUnwatch(chatId: number, arg?: string) {
  const before = watches.length;
  watches = watches.filter((w) => !(w.chatId === chatId && (!arg || w.address.toLowerCase() === arg.toLowerCase())));
  saveWatches();
  await send(chatId, before === watches.length ? "Nothing to stop watching." : "Stopped.");
}

async function cmdWatching(chatId: number) {
  const mine = watches.filter((w) => w.chatId === chatId);
  await send(
    chatId,
    mine.length
      ? ["<b>Watching</b>", "", ...mine.map((w) => `<code>${escape(w.address)}</code>`)].join("\n")
      : "Not watching anything yet. Send <code>/watch 0x…</code>",
  );
}

// --- the alert loop ----------------------------------------------------------------------------

async function checkWatches() {
  for (const watch of watches) {
    try {
      const position = await getPosition(watch.address);
      if (position.priceStale || position.healthFactor === null) continue;

      if (position.healthFactor < ALERT_BELOW && !watch.alerted) {
        watch.alerted = true;
        saveWatches();
        await send(
          watch.chatId,
          [
            "⚠️ <b>Health factor falling</b>",
            "",
            describePosition(watch.address, position),
            "",
            "Repay or add collateral to move it back up. Below 1.00 anyone may liquidate.",
          ].join("\n"),
        );
      } else if (position.healthFactor > RECOVERED_ABOVE && watch.alerted) {
        watch.alerted = false;
        saveWatches();
        await send(watch.chatId, `✅ Recovered: health factor back to ${position.healthFactor.toFixed(2)}.`);
      }
    } catch (error) {
      console.error("watch check failed", watch.address, error instanceof Error ? error.message : error);
    }
  }
}

// --- main --------------------------------------------------------------------------------------

async function handle(update: Record<string, any>) {
  const message = update.message;
  const text: string | undefined = message?.text;
  if (!message || !text?.startsWith("/")) return;

  const chatId = message.chat.id as number;
  const [command, arg] = text.split(/\s+/);
  const name = command.split("@")[0];

  try {
    if (name === "/start" || name === "/help") await cmdStart(chatId);
    else if (name === "/markets") await cmdMarkets(chatId);
    else if (name === "/pool") await cmdPool(chatId);
    else if (name === "/position") await cmdPosition(chatId, arg);
    else if (name === "/watch") await cmdWatch(chatId, arg);
    else if (name === "/unwatch") await cmdUnwatch(chatId, arg);
    else if (name === "/watching") await cmdWatching(chatId);
  } catch (error) {
    console.error("command failed", name, error);
    await send(chatId, "Something went wrong reading the chain. Try again in a moment.").catch(() => {});
  }
}

const me = await (await fetch(`${API}/getMe`)).json();
if (!me.ok) {
  console.error("Token rejected by Telegram:", me.description);
  process.exit(1);
}
console.log(`Connected as @${me.result.username} (${me.result.first_name})`);

if (process.argv.includes("--check")) {
  console.log("Token is valid. Vault:", deployment.vault);
  process.exit(0);
}

await api("setMyCommands", {
  commands: [
    { command: "markets", description: "Live collateral prices" },
    { command: "pool", description: "Lending pool and rates" },
    { command: "position", description: "Position for an address" },
    { command: "watch", description: "Alert me if health falls" },
    { command: "unwatch", description: "Stop alerts" },
    { command: "watching", description: "What I am watching" },
  ],
});

setInterval(() => void checkWatches(), POLL_SECONDS * 1000);
console.log(`Watching ${watches.length} address(es); health checks every ${POLL_SECONDS}s.`);

let offset = 0;
for (;;) {
  try {
    const updates = (await api("getUpdates", { offset, timeout: 30 })) as Record<string, any>[];
    for (const update of updates) {
      offset = update.update_id + 1;
      await handle(update);
    }
  } catch (error) {
    console.error("polling error", error instanceof Error ? error.message : error);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
