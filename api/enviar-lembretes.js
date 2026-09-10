// api/enviar-lembretes.js — Vercel Cron Job (ver vercel.json pro agendamento)
// Mesma lógica de netlify/functions/enviar-lembretes.js.
// Protegida por CRON_SECRET: só o agendador do Vercel (ou quem tiver o segredo) pode chamar,
// senão qualquer pessoa poderia bater nessa URL pública e disparar notificações à vontade.

const { getFirebaseAdminApp } = require('../lib/firebaseAdmin');
const { getFirestore }        = require('firebase-admin/firestore');
const { getMessaging }        = require('firebase-admin/messaging');

getFirebaseAdminApp();
const db = getFirestore();

function dataStr(d) {
  return d.toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  // Vercel manda esse cabeçalho automaticamente quando é o próprio agendador chamando
  const auth = req.headers['authorization'];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false, erro: 'não autorizado' });
    return;
  }

  try {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const hojeStr = dataStr(hoje);
    const amanhaStr = dataStr(amanha);

    const snap = await db.collectionGroup('eventos')
      .where('data', 'in', [hojeStr, amanhaStr])
      .get();

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
      const tokens = userSnap.data()?.fcmTokens || [];
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

    res.status(200).json({ ok: true, notificacoesEnviadas: enviados });
  } catch (err) {
    console.error('Erro geral em enviar-lembretes:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
