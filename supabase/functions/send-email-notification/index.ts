import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? '';
const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'BuildFlow <no-reply@buildflow.app>';
// URL publique de l'app — à surcharger via le secret APP_URL dans le dashboard Supabase.
// Valeur par défaut : URL Vercel de production (build-flow-v1.vercel.app).
const APP_URL = Deno.env.get('APP_URL') ?? 'https://build-flow-v1.vercel.app';

Deno.serve(async (req: Request) => {
  // Valider le secret webhook
  const secret = req.headers.get('x-webhook-secret');
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Pas de clé Resend configurée → log et sortie propre
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email send');
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let notification: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
  };

  try {
    notification = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Récupérer l'email du destinataire via service role
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${notification.user_id}&select=email,full_name`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    }
  );

  if (!profileRes.ok) {
    console.error('Failed to fetch profile', await profileRes.text());
    return new Response('Profile fetch error', { status: 502 });
  }

  const profiles: { email: string; full_name: string | null }[] = await profileRes.json();
  const profile = profiles[0];

  if (!profile?.email) {
    console.warn(`No email found for user ${notification.user_id}`);
    return new Response(JSON.stringify({ skipped: true, reason: 'no email' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const linkHtml = notification.link
    ? `<p style="margin-top:16px"><a href="${APP_URL}${notification.link}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-size:14px">Voir dans BuildFlow →</a></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:32px 16px;}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:32px;}
  h2{margin:0 0 8px;font-size:18px;color:#0f172a;}
  p{margin:8px 0;color:#475569;font-size:15px;line-height:1.6;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;}
</style></head>
<body>
  <div class="card">
    <h2>${notification.title}</h2>
    ${notification.message ? `<p>${notification.message}</p>` : ''}
    ${linkHtml}
    <div class="footer">Vous recevez cet email car vous êtes membre d'un projet BuildFlow. Pour gérer vos préférences, connectez-vous à l'application.</div>
  </div>
</body>
</html>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [profile.email],
      subject: notification.title,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error('Resend error', resendRes.status, err);
    return new Response('Email send failed', { status: 502 });
  }

  const result = await resendRes.json();
  console.log(`Email sent to ${profile.email} for notification ${notification.id}`, result);

  return new Response(JSON.stringify({ ok: true, email: profile.email }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
