// netlify/functions/criar-assinatura.js
// Cria uma assinatura no Mercado Pago e retorna o ID para o checkout

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { uid, nome, email } = JSON.parse(event.body || '{}');

    if (!uid || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'uid e email são obrigatórios' }) };
    }

    const token = process.env.MP_ACCESS_TOKEN;

    // Cria a assinatura pendente no MP
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: '3907e309aeaf4f6c9ce98ab1672f8ba3',
        payer_email: email,
        external_reference: uid,
        back_url: 'https://agenda-fotografia.vercel.app',
      }),
    });

    const data = await response.json();
    console.log('Assinatura criada:', JSON.stringify(data));

    if (data.id) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          id: data.id,
          init_point: data.init_point,
        }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.message || 'Erro ao criar assinatura' }),
      };
    }

  } catch (err) {
    console.error('Erro criar-assinatura:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
