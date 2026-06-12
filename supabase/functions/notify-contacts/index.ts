/*
 * Supabase Edge Function: notify-contacts.
 * Triggered by a database webhook when a new SOS alert is inserted. Fetches the
 * affected user's emergency contacts from the 'emergency_contacts' table and
 * sends each one an SMS via the Twilio API containing the user's name, GPS
 * coordinates (Google Maps link), and optional notes. Requires the environment
 * variables SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and NOTIFY_CONTACTS_WEBHOOK_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// In-memory rate limiter — 5 min cooldown per user_id (resets on cold start)
const lastSentAt = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000;

const sanitizeText = (value: unknown, maxLength: number): string =>
  String(value ?? '')
    .replace(/[\r\n]/g, ' ')
    .slice(0, maxLength);

serve(async (req) => {
  try {
    // Validate webhook secret to prevent unauthenticated SMS triggering
    const WEBHOOK_SECRET = Deno.env.get('NOTIFY_CONTACTS_WEBHOOK_SECRET');
    if (!WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
    }
    const incomingSecret = req.headers.get('x-webhook-secret');
    if (incomingSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const payload = await req.json();
    const sosAlert = payload.record;

    if (!sosAlert || !sosAlert.user_id) {
      return new Response('No valid data received', { status: 400 });
    }

    // Per-user rate limiting
    const lastSent = lastSentAt.get(sosAlert.user_id) ?? 0;
    if (Date.now() - lastSent < RATE_LIMIT_MS) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
    }
    lastSentAt.set(sosAlert.user_id, Date.now());

    // Validate required env vars before initializing clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: contacts } = await supabaseClient
      .from('emergency_contacts')
      .select('phone_number, name')
      .eq('user_id', sosAlert.user_id);

    if (!contacts || contacts.length === 0) {
      return new Response('No emergency contacts found', { status: 200 });
    }

    // Sanitize all user-supplied fields before SMS interpolation
    const firstName = sanitizeText(sosAlert.first_name, 50);
    const lastName  = sanitizeText(sosAlert.last_name, 50);
    const notes     = sanitizeText(sosAlert.notes, 200);
    const lat       = parseFloat(sosAlert.latitude)  || 0;
    const lon       = parseFloat(sosAlert.longitude) || 0;

    const userName       = `${firstName} ${lastName}`.trim() || 'Unknown';
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
    const smsMessage     = `URGENT: ${userName} has triggered an SOS alert.\nLocation: ${googleMapsLink}\nNotes: ${notes || 'None'}`;

    const TWILIO_ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      await Promise.all(
        contacts.map(async (contact) => {
          const formData = new URLSearchParams();
          formData.append('To', contact.phone_number);
          formData.append('From', TWILIO_PHONE_NUMBER);
          formData.append('Body', smsMessage);

          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              },
              body: formData.toString(),
            },
          );
        }),
      );
    }

    return new Response(JSON.stringify({ success: true, notified: contacts.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook internal error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
