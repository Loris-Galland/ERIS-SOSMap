import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // 1. Récupération des données envoyées par le Webhook de Supabase
    const payload = await req.json();
    const sosAlert = payload.record; // Contient la nouvelle ligne insérée dans sos_alerts

    if (!sosAlert || !sosAlert.user_id) {
      return new Response('Aucune donnée valide', { status: 400 });
    }

    // 2. Initialisation du client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 3. Récupérer les contacts d'urgence de cet utilisateur
    const { data: contacts } = await supabaseClient
      .from('emergency_contacts')
      .select('phone_number, name')
      .eq('user_id', sosAlert.user_id);

    if (!contacts || contacts.length === 0) {
      return new Response("Aucun contact d'urgence trouvé.", { status: 200 });
    }

    // 4. Préparer le message SMS
    const userName = `${sosAlert.first_name} ${sosAlert.last_name}`;
    const googleMapsLink = `https://maps.google.com/?q=${sosAlert.latitude},${sosAlert.longitude}`;
    const smsMessage = `🚨 URGENT : ${userName} a déclenché un SOS.\nPosition : ${googleMapsLink}\nNotes : ${sosAlert.notes || 'Aucune'}`;

    // 5. Envoyer le SMS via Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      await Promise.all(
        contacts.map(async (contact) => {
          const formData = new URLSearchParams();
          formData.append('To', contact.phone_number);
          formData.append('From', TWILIO_PHONE_NUMBER!);
          formData.append('Body', smsMessage);

          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            },
            body: formData.toString(),
          });
        }),
      );
    }

    return new Response(JSON.stringify({ success: true, notified: contacts.length }), { status: 200 });
  } catch (error) {
    console.error('Erreur Webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
