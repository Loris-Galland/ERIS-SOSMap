import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    //Parse payload from Supabase Webhook
    const payload = await req.json();
    const sosAlert = payload.record;

    if (!sosAlert || !sosAlert.user_id) {
      return new Response('No valid data received', { status: 400 });
    }

    //Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    //Fetch emergency contacts for the user
    const { data: contacts } = await supabaseClient
      .from('emergency_contacts')
      .select('phone_number, name')
      .eq('user_id', sosAlert.user_id);

    if (!contacts || contacts.length === 0) {
      return new Response("No emergency contacts found", { status: 200 });
    }

    //Prepare SMS content
    const userName = `${sosAlert.first_name} ${sosAlert.last_name}`;
    const googleMapsLink = `https://www.google.com/maps?q=${sosAlert.latitude},${sosAlert.longitude}`;
    const smsMessage = `URGENT: ${userName} has triggered an SOS alert.\nLocation: ${googleMapsLink}\nNotes: ${sosAlert.notes || 'None'}`;

    //Send SMS via Twilio API
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
              'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            },
            body: formData.toString(),
          });
        }),
      );
    }

    return new Response(JSON.stringify({ success: true, notified: contacts.length }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});