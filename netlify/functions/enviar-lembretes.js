// netlify/functions/enviar-lembretes.js
// Roda sozinha, agendada (ver netlify.toml), sem precisar de ninguém abrir o app.
// Busca eventos de hoje e de amanhã de TODOS os fotógrafos, e manda push notification
// pros tokens de dispositivo salvos de cada um.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');
const { getMessaging }                  = require('firebase-admin/messaging');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

function dataStr(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

exports.handler = async function () {
  try {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const hojeStr = dataStr(hoje);
    const amanhaStr = dataStr(amanha);

    // Busca em TODOS os usuários de uma vez (collection group query)
    const snap = await db.collectionGroup('eventos')
      .where('data', 'in', [hojeStr, amanhaStr])
      .get();

    // Agrupa por usuário (uid vem do caminho do documento: usuarios/{uid}/eventos/{id})
    const porUsuario = {};
    snap.forEach((docSnap) => {
      const e = docSnap.data();
      if (e.status === 'entregue' || e.status === 'adiado' || e.tipo === 'banlek') return;
      const uid = docSnap.ref.parent.parent.id;
      if (!porUsuario[uid]) porUsuario[uid] = [];
      porUsuario[uid].push(e);
    });

    let enviados = 0;

    for (const uid of Object.keys(porUsuario)) {
      const userSnap = await db.collection('usuarios').doc(uid).get();
      const userData = userSnap.data();
      const tokens = userData?.fcmTokens || [];
      if (!tokens.length) continue;

      for (const e of porUsuario[uid]) {
        const ehHoje = (e.data || '') === hojeStr;
        const titulo = ehHoje ? '📍 Evento hoje' : '⏰ Evento amanhã';
        const corpo = `${e.nome || 'Evento'}${e.hora ? ' às ' + e.hora : ''}`;

        try {
          const resp = await getMessaging().sendEachForMulticast({
            tokens,
            notification: { title: titulo, body: corpo },
            webpush: { fcmOptions: { link: '/index.html' } }
          });
          enviados += resp.successCount;

          // Remove tokens inválidos/expirados encontrados nesse envio
          const tokensInvalidos = [];
          resp.responses.forEach((r, i) => {
            if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
              tokensInvalidos.push(tokens[i]);
            }
          });
          if (tokensInvalidos.length) {
            await db.collection('usuarios').doc(uid).update({
              fcmTokens: tokens.filter(t => !tokensInvalidos.includes(t))
            });
          }
        } catch (err) {
          console.error(`Erro ao enviar push pro usuário ${uid}:`, err);
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, notificacoesEnviadas: enviados }) };
  } catch (err) {
    console.error('Erro geral em enviar-lembretes:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, erro: err.message }) };
  }
};
