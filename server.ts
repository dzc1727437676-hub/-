import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("data.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS msku_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    msku TEXT NOT NULL,
    platform_zh TEXT NOT NULL,
    category1 TEXT,
    category2 TEXT,
    attr_name TEXT,
    product_type TEXT,
    UNIQUE(msku, platform_zh)
  );

  CREATE TABLE IF NOT EXISTS platform_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_platform TEXT UNIQUE NOT NULL,
    platform_zh TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const PORT = 3000;

  // API Routes
  app.get("/api/mappings/msku", (req, res) => {
    const rows = db.prepare("SELECT * FROM msku_mapping").all();
    res.json(rows);
  });

  app.post("/api/mappings/msku", (req, res) => {
    const { id, msku, platform_zh, category1, category2, attr_name, product_type } = req.body;
    try {
      const info = db.prepare(`
        INSERT OR REPLACE INTO msku_mapping (id, msku, platform_zh, category1, category2, attr_name, product_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id || null, msku, platform_zh, category1, category2, attr_name, product_type);
      res.json({ id: id || info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/mappings/msku/bulk", (req, res) => {
    const items = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO msku_mapping (msku, platform_zh, category1, category2, attr_name, product_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((data) => {
      for (const item of data) {
        insert.run(item.msku, item.platform_zh, item.category1, item.category2, item.attr_name, item.product_type);
      }
    });

    try {
      transaction(items);
      res.json({ success: true, count: items.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/mappings/msku/:id", (req, res) => {
    db.prepare("DELETE FROM msku_mapping WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/mappings/platform", (req, res) => {
    const rows = db.prepare("SELECT * FROM platform_mapping").all();
    res.json(rows);
  });

  app.post("/api/mappings/platform", (req, res) => {
    const { id, source_platform, platform_zh } = req.body;
    try {
      const info = db.prepare(`
        INSERT OR REPLACE INTO platform_mapping (id, source_platform, platform_zh)
        VALUES (?, ?, ?)
      `).run(id || null, source_platform, platform_zh);
      res.json({ id: id || info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/mappings/platform/bulk", (req, res) => {
    const items = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO platform_mapping (source_platform, platform_zh)
      VALUES (?, ?)
    `);
    
    const transaction = db.transaction((data) => {
      for (const item of data) {
        insert.run(item.source_platform, item.platform_zh);
      }
    });

    try {
      transaction(items);
      res.json({ success: true, count: items.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/mappings/platform/:id", (req, res) => {
    db.prepare("DELETE FROM platform_mapping WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  // Proxy endpoint for AI requests to bypass CORS
  app.post("/api/ai/chat", async (req, res) => {
    const { baseUrl, apiKey, payload } = req.body;
    
    if (!baseUrl || !apiKey || !payload) {
      return res.status(400).json({ error: "Missing baseUrl, apiKey, or payload" });
    }

    try {
      // Clean up baseUrl to avoid appending /chat/completions twice
      const cleanBaseUrl = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      // Use native fetch in Node.js
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(response.status || 500).json({ 
          error: `API 返回了非 JSON 格式的数据 (状态码: ${response.status}): ${text.substring(0, 100)}...` 
        });
      }
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
