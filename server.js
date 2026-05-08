const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const SB_URL = "https://yevzrkpmuwhydvuurbds.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlldnpya3BtdXdoeWR2dXVyYmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDM2MjIsImV4cCI6MjA5MzY3OTYyMn0.d5_2tTTop9gbKefTjBl-2mqCbtb6PjXxOYoIA8oJuK0";

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── PROXY para Supabase ──
app.get('/api/get/:chave', async (req, res) => {
  try {
    const chave = decodeURIComponent(req.params.chave);
    const r = await fetch(`${SB_URL}/rest/v1/registros?chave=eq.${encodeURIComponent(chave)}&select=valor`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const data = await r.json();
    res.json({ valor: data?.[0]?.valor || null });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/set', async (req, res) => {
  try {
    const { chave, valor } = req.body;
    const r = await fetch(`${SB_URL}/rest/v1/registros`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ chave, valor, atualizado_em: new Date().toISOString() })
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/list/:prefix', async (req, res) => {
  try {
    const prefix = decodeURIComponent(req.params.prefix);
    const r = await fetch(`${SB_URL}/rest/v1/registros?chave=like.${encodeURIComponent(prefix + '%')}&select=chave,valor&limit=1000`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const data = await r.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/del/:chave', async (req, res) => {
  try {
    const chave = decodeURIComponent(req.params.chave);
    await fetch(`${SB_URL}/rest/v1/registros?chave=eq.${encodeURIComponent(chave)}`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Diário rodando na porta ${PORT}`);
});
