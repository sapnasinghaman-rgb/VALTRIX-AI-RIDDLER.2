import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "64kb" }));

const PORT = Number(process.env.PORT || 3000);
const CLIENT_TOKEN = process.env.RIDDLE_CLIENT_TOKEN;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.get("/", (_req, res) => res.type("text").send("Riddler proxy is running."));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/riddler", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!CLIENT_TOKEN || !AI_API_KEY) {
      return res.status(503).json({ ok: false, error: "Server is not configured" });
    }

    if (typeof body.token !== "string" || body.token !== CLIENT_TOKEN) {
      return res.status(401).json({ ok: false, error: "Invalid client token" });
    }

    if (body.op === "warm") {
      return res.json({ ok: true, text: "ready" });
    }

    if (body.op !== "solve") {
      return res.status(400).json({ ok: false, error: "Unsupported operation" });
    }

    if (typeof body.riddle !== "string" || !body.riddle.trim()) {
      return res.status(400).json({ ok: false, error: "Missing riddle" });
    }

    const context = typeof body.liveState === "string"
      ? body.liveState.slice(0, 12000)
      : "";

    const prompt = [
      "You are a concise game-riddle assistant.",
      "Use the supplied live game state as the primary source when present.",
      "Do not invent item names, codes, counts, or facts. If the answer cannot be determined, say so briefly.",
      "Return only the answer in the format CODE: <answer> when it is a redeemable code,",
      "or ANSWER: <answer> for a normal riddle. Do not include markdown.",
      context ? `LIVE GAME STATE:\n${context}` : "",
      `RIDDLE:\n${body.riddle}`
    ].filter(Boolean).join("\n\n");

    const upstream = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 180
      }),
      signal: AbortSignal.timeout(25_000)
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error("AI provider returned status:", upstream.status);
      return res.status(502).json({ ok: false, error: "AI provider request failed" });
    }

    let data;
    try { data = JSON.parse(raw); }
    catch { return res.status(502).json({ ok: false, error: "AI provider returned invalid JSON" }); }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ ok: false, error: "AI provider returned no answer" });
    }

    return res.json({ ok: true, text: answer.trim() });
  } catch (err) {
    console.error("Request failed:", err?.name || "Error");
    return res.status(500).json({ ok: false, error: "Internal proxy error" });
  }
});

app.listen(PORT, () => console.log(`Riddler proxy listening on ${PORT}`));
