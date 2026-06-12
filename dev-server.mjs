// dev-server.mjs
// Servidor Express LOCAL apenas para desenvolvimento — substitui o `vercel dev`,
// que crasha no Windows com Node 24 (Assertion failed: UV_HANDLE_CLOSING).
//
// Em produção, a Vercel continua expondo cada arquivo de api/*.js como uma
// Serverless Function — este arquivo NUNCA roda em produção.
//
// Como funciona:
//  - Lê .env.local (e .env como fallback) e popula process.env.
//  - Para cada api/*.js, mapeia POST/GET/* /api/<nome> -> handler default
//    do módulo, no mesmo formato (req, res) que a Vercel usa.
//  - Fica em http://localhost:3001. O CRA (`npm start`) roda em :3000 e
//    encaminha chamadas /api/* para cá via "proxy" do package.json.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1) Carrega variáveis de ambiente. .env.local tem prioridade.
const envLocal = path.join(__dirname, ".env.local");
const envBase = path.join(__dirname, ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: true });
if (fs.existsSync(envBase)) dotenv.config({ path: envBase, override: false });

const app = express();

// Captura o body cru (necessário p/ webhooks tipo Stripe) e também expõe
// req.body como JSON quando aplicável.
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rewrites locais para manter paridade com vercel.json durante o desenvolvimento.
app.all("/api/parse-cv", async (req, res, next) => {
  try {
    const chatGeminiFileUrl = pathToFileURL(path.join(__dirname, "api", "chat-gemini.js")).href;
    const mod = await import(chatGeminiFileUrl);
    const handler = mod.default || mod.handler;
    if (typeof handler !== "function") {
      throw new Error("api/chat-gemini.js não exporta um handler default");
    }

    const originalQuery = req.query || {};
    const rewrittenReq = Object.create(req);
    Object.defineProperty(rewrittenReq, "query", {
      value: { ...originalQuery, op: "parse-cv" },
      writable: true,
      configurable: true,
      enumerable: true,
    });
    await handler(rewrittenReq, res);
  } catch (err) {
    if (res.headersSent) return;
    console.error("[dev-server] erro no rewrite /api/parse-cv -> /api/chat-gemini?op=parse-cv:", err);
    res.status(500).json({
      message: "Erro interno do servidor (dev).",
      error: err?.message || String(err),
    });
  }
});

// 2) Auto-monta cada arquivo de api/*.js como rota /api/<nome>.
const apiDir = path.join(__dirname, "api");
const files = fs
  .readdirSync(apiDir)
  .filter((f) => f.endsWith(".js") && !f.startsWith("_"));

for (const file of files) {
  const routeName = file.replace(/\.js$/, "");
  const route = `/api/${routeName}`;
  const fileUrl = pathToFileURL(path.join(apiDir, file)).href;

  // Lazy import: o módulo só é carregado na primeira chamada, evitando
  // travar a inicialização caso algum endpoint tenha import pesado.
  let cachedHandler = null;
  const getHandler = async () => {
    if (cachedHandler) return cachedHandler;
    const mod = await import(fileUrl);
    cachedHandler = mod.default || mod.handler;
    if (typeof cachedHandler !== "function") {
      throw new Error(`api/${file} não exporta um handler default`);
    }
    return cachedHandler;
  };

  app.all(route, async (req, res) => {
    try {
      const handler = await getHandler();
      await handler(req, res);
    } catch (err) {
      console.error(`[dev-server] erro em ${route}:`, err);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Erro interno do servidor (dev).",
          error: err?.message || String(err),
        });
      }
    }
  });

  console.log(`  ✔ mapeado ${route}  ->  api/${file}`);
}

const PORT = Number(process.env.DEV_API_PORT || 3001);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`\n✅ Dev API rodando em http://localhost:${PORT}`);
  console.log(`   (use o CRA em :3000 — o "proxy" do package.json encaminha /api/* pra cá)\n`);
});
