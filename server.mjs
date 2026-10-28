import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function stripDataUrl(s) {
  const m = String(s || "").match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/s);
  if (!m) throw new Error("Expected PNG/JPEG data URL");
  return { format: m[1] === "jpeg" ? "jpeg" : m[1], data_base64: m[2] };
}

// Accept a few plausible response shapes so the UI survives API shape changes.
function extractConfidence(answer) {
  if (!answer || typeof answer !== "object") return null;
  const candidates = [
    answer.confidence,
    answer.probability,
    answer.score,
    answer.box?.confidence,
    answer.bounding_box?.confidence,
    answer.bbox?.confidence,
    answer.value?.confidence
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeBox(answer) {
  if (!answer) return null;

  let b =
    answer.box ??
    answer.bounding_box ??
    answer.bbox ??
    answer.value ??
    answer;

  if (Array.isArray(b) && b.length >= 4) {
    const [a,c,d,e] = b.map(Number);
    return { x1:a, y1:c, x2:d, y2:e };
  }

  if (b && typeof b === "object") {
    if (["x1","y1","x2","y2"].every(k => Number.isFinite(Number(b[k])))) {
      return { x1:+b.x1, y1:+b.y1, x2:+b.x2, y2:+b.y2 };
    }
    if (["left","top","right","bottom"].every(k => Number.isFinite(Number(b[k])))) {
      return { x1:+b.left, y1:+b.top, x2:+b.right, y2:+b.bottom };
    }
    if (["x","y","width","height"].every(k => Number.isFinite(Number(b[k])))) {
      return { x1:+b.x, y1:+b.y, x2:+b.x + +b.width, y2:+b.y + +b.height };
    }
  }
  return null;
}

async function askJev(frameUrl) {
  if (!API_KEY) throw new Error("Missing JEV_API_KEY (or TYPESAFE_API_KEY)");

  const img = stripDataUrl(frameUrl);
  const placeholder = "CAMERA_FRAME";

  const payload = {
    model: "jev-1.14.0",
    assets: {
      [placeholder]: {
        type: "image",
        format: img.format,
        data_base64: img.data_base64
      }
    },
    state: {
      image: placeholder
    },
    questions: {
      ghost: {
        type: "box",
        instructions: "Where is the ghost?"
      }
    }
  };

  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${API_KEY}`,
      "content-type": "application/json",
      "TypeSafe-Danger-Zone-Images": "true"
    },
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Jev ${r.status}: ${text}`);

  const data = JSON.parse(text);
  const raw = data?.answers?.ghost;
  const box = normalizeBox(raw);

  return {
    model: data.model || "jev-1.14.0",
    box,
    confidence: extractConfidence(raw),
    raw,
    usage: data.usage || null
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/ghost") {
      const body = await readJson(req);
      const out = await askJev(body.frame);
      return send(res, 200, JSON.stringify(out));
    }

    let reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const target = path.normalize(path.join(__dirname, reqPath));
    if (!target.startsWith(__dirname)) return send(res, 403, "forbidden", "text/plain");
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      return send(res, 404, "not found", "text/plain");
    }
    return send(res, 200, fs.readFileSync(target), MIME[path.extname(target)] || "application/octet-stream");
  } catch (err) {
    return send(res, 500, JSON.stringify({ error: err?.message || String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`JEV//GHOST box test: http://localhost:${PORT}`);
  console.log(API_KEY ? "Jev API key detected." : "WARNING: set JEV_API_KEY first.");
});
