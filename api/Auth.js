import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, action } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    if (action === 'signup') {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error) throw error;

      // Créer le profil avec plan gratuit
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        plan: 'free',
        trials_used: 0,
        created_at: new Date().toISOString()
      });

      // Connecter directement
      const { data: session, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      return res.status(200).json({
        token: session.session.access_token,
        user: { email, plan: 'free', trials_used: 0 }
      });

    } else if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Récupérer le profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      return res.status(200).json({
        token: data.session.access_token,
        user: {
          email: data.user.email,
          plan: profile?.plan || 'free',
          trials_used: profile?.trials_used || 0
        }
      });
    }

    return res.status(400).json({ error: 'Action invalide' });

  } catch (error) {
    const msg = error.message || 'Erreur serveur';
    if (msg.includes('already registered')) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé. Connectez-vous.' });
    }
    if (msg.includes('Invalid login')) {
      return res.status(400).json({ error: 'Email ou mot de passe incorrect.' });
    }
    return res.status(500).json({ error: msg });
  }
}
