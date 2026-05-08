const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const SB_URL = "https://yevzrkpmuwhydvuurbds.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlldnpya3BtdXdoeWR2dXVyYmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDM2MjIsImV4cCI6MjA5MzY3OTYyMn0.d5_2tTTop9gbKefTjBl-2mqCbtb6PjXxOYoIA8oJuK0";

const SB_HEADERS = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  const p = req.path;
  const noCache = p === '/' || p.endsWith('.html') || p.startsWith('/api/') || p === '/sw.js' || p === '/manifest.json';
  if (noCache) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// GET: pega a versao mais RECENTE da chave
app.get('/api/get/:chave', async (req, res) => {
  try {
    const chave = decodeURIComponent(req.params.chave);
    const url = SB_URL + '/rest/v1/registros?chave=eq.' + encodeURIComponent(chave) + '&select=valor,atualizado_em&order=atualizado_em.desc&limit=1';
    const r = await fetch(url, { headers: SB_HEADERS });
    const txt = await r.text();
    if (!r.ok) return res.status(r.status).type('json').send(txt);
    let data; try { data = JSON.parse(txt); } catch { data = []; }
    res.json({ valor: data && data[0] && data[0].valor ? data[0].valor : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SET: DELETE da chave existente + INSERT da nova. Garante 1 row por chave.
app.post('/api/set', async (req, res) => {
  try {
    const chave = req.body && req.body.chave;
    const valor = req.body && req.body.valor;
    if (!chave) return res.status(400).json({ error: 'chave obrigatoria' });

    await fetch(SB_URL + '/rest/v1/registros?chave=eq.' + encodeURIComponent(chave), {
      method: 'DELETE',
      headers: SB_HEADERS
    });

    const r = await fetch(SB_URL + '/rest/v1/registros', {
      method: 'POST',
      headers: Object.assign({}, SB_HEADERS, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      }),
      body: JSON.stringify({ chave: chave, valor: valor, atualizado_em: new Date().toISOString() })
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LIST: ordena por atualizado_em desc e dedupa por chave (pega so a mais nova)
app.get('/api/list/:prefix', async (req, res) => {
  try {
    const prefix = decodeURIComponent(req.params.prefix);
    const url = SB_URL + '/rest/v1/registros?chave=like.' + encodeURIComponent(prefix + '%') + '&select=chave,valor,atualizado_em&order=atualizado_em.desc&limit=5000';
    const r = await fetch(url, { headers: SB_HEADERS });
    const txt = await r.text();
    if (!r.ok) return res.status(r.status).type('json').send(txt);
    let data; try { data = JSON.parse(txt); } catch { data = []; }
    const seen = new Set();
    const dedup = [];
    for (const row of data) {
      if (!seen.has(row.chave)) {
        seen.add(row.chave);
        dedup.push({ chave: row.chave, valor: row.valor });
      }
    }
    res.json(dedup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/del/:chave', async (req, res) => {
  try {
    const chave = decodeURIComponent(req.params.chave);
    await fetch(SB_URL + '/rest/v1/registros?chave=eq.' + encodeURIComponent(chave), {
      method: 'DELETE',
      headers: SB_HEADERS
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Limpa duplicatas existentes (mantem so a mais nova de cada chave)
app.post('/api/cleanup-duplicates', async (req, res) => {
  try {
    const r = await fetch(SB_URL + '/rest/v1/registros?select=chave,atualizado_em&order=atualizado_em.desc&limit=10000', {
      headers: SB_HEADERS
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    const all = await r.json();
    const seen = new Set();
    const toDelete = [];
    for (const row of all) {
      if (!seen.has(row.chave)) {
        seen.add(row.chave);
      } else {
        toDelete.push(row);
      }
    }
    for (const row of toDelete) {
      await fetch(SB_URL + '/rest/v1/registros?chave=eq.' + encodeURIComponent(row.chave) + '&atualizado_em=eq.' + encodeURIComponent(row.atualizado_em), {
        method: 'DELETE',
        headers: SB_HEADERS
      });
    }
    res.json({ ok: true, total: all.length, deleted: toDelete.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Diario rodando na porta ' + PORT);
});
