// api/instagram-embed.js — Vercel Serverless Function
// Busca o HTML de embed de um post público do Instagram via oEmbed da Meta.
// Desde 15/06/2026 esse endpoint não exige mais token nem aprovação de app.
// Fica num endpoint nosso (em vez do navegador chamar direto) pra evitar problema
// de CORS e centralizar caso a Meta mude a URL/formato de novo no futuro.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.query.url;
  if (!url || !url.includes('instagram.com')) {
    res.status(400).json({ ok: false, erro: 'Parâmetro url inválido' });
    return;
  }

  try {
    const oembedUrl = `https://graph.facebook.com/v26.0/oembed_post?url=${encodeURIComponent(url)}&omitscript=true`;
    const resp = await fetch(oembedUrl);
    const data = await resp.json();

    if (!resp.ok || !data.html) {
      res.status(200).json({ ok: false, erro: data.error?.message || 'Post não encontrado ou privado' });
      return;
    }

    res.status(200).json({ ok: true, html: data.html });
  } catch (err) {
    console.error('Erro ao buscar embed do Instagram:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
