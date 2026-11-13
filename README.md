# Riddler Proxy

A small Node.js backend implementing the interface used by the supplied Riddler Lua script.

## Routes

- `GET /health` — health check.
- `POST /api/riddler` — JSON API used by the script.
- `op: "warm"` — returns `{ "ok": true, "text": "ready" }`.
- `op: "solve"` — expects `riddle`, optional `liveState`, and returns `{ "ok": true, "text": "ANSWER: ..." }`.

## Configure

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Set `RIDDLE_CLIENT_TOKEN` to the exact client token sent by your Lua script.
4. Set `AI_API_KEY` to your own AI provider API key.
5. Optionally set `AI_BASE_URL` and `AI_MODEL` for an OpenAI-compatible provider.
6. Run `npm install` and `npm start`.

Do not commit `.env` or share your provider API key.

## Connect the Lua script

Set the proxy URL to your deployed server route:

```lua
_G.__RiddlerProxyUrl = "https://YOUR-HOST/api/riddler"
```

The script sends JSON by POST and expects a JSON response with `ok` and `text`.
The server also checks `body.token` against `RIDDLE_CLIENT_TOKEN`.

## Deploy

Deploy this folder as a Node web service on a host that supports Node.js. Set the environment variables in the host dashboard, then use the public HTTPS URL plus `/api/riddler`.

## Important

This is a starter backend, not a hosted service: creating these files does not publish a public URL. You must deploy it and configure your own provider credentials. The Lua client token is visible to anyone who can read the script, so it should not be treated as strong authentication. Use rate limits and rotate it if exposed.
