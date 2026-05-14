import { createClient } from '@supabase/supabase-js';

const MAX_FREE_TRIALS = 3;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function getUserFromToken(token) {
  if (!token) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return res.status(403).json({ error: 'Profil introuvable.' });

    if (profile.plan === 'free') {
      if (profile.trials_used >= MAX_FREE_TRIALS) {
        return res.status(403).json({
          error: 'limit_reached',
          message: 'Limite gratuite atteinte. Passez au plan Pro.',
          trials_used: profile.trials_used
        });
      }
      await supabase
        .from('profiles')
        .update({ trials_used: profile.trials_used + 1 })
        .eq('id', user.id);
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, trials_used')
        .eq('id', user.id)
        .single();
      data._profile = profile;
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
