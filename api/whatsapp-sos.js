/**
 * LIFELINE - WhatsApp SOS Notification API
 * Vercel Serverless Function: /api/whatsapp-sos
 *
 * This is the SECURE backend that holds the WhatsApp API credentials.
 * The frontend NEVER sees the access token — it only calls this endpoint.
 *
 * Required Environment Variables (set in Vercel Dashboard > Settings > Environment Variables):
 *   WHATSAPP_ACCESS_TOKEN        - Meta WhatsApp Cloud API permanent token
 *   WHATSAPP_PHONE_NUMBER_ID     - Your registered WhatsApp Business phone number ID
 *   WHATSAPP_RECIPIENT_PHONE     - Emergency contact phone number (E.164: +919876543210)
 *   WHATSAPP_TEMPLATE_NAME       - Approved template name (default: lifeline_sos_alert)
 *   WHATSAPP_TEMPLATE_LANG       - Template language code (default: en)
 *   ALLOWED_ORIGIN               - Frontend origin for CORS (default: https://subhamshaw0107.github.io)
 */

export default async function handler(req, res) {
  // --- CORS ---
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://subhamshaw0107.github.io';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // --- Validate required env vars ---
  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_RECIPIENT_PHONE,
    WHATSAPP_TEMPLATE_NAME = 'lifeline_sos_alert',
    WHATSAPP_TEMPLATE_LANG = 'en',
  } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_RECIPIENT_PHONE) {
    console.error('[WhatsApp API] Missing required environment variables');
    return res.status(503).json({
      success: false,
      error: 'WhatsApp notification service is not configured on this server.',
    });
  }

  // --- Parse & validate request body ---
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  const { sosId, senderId, latitude, longitude, priority, message, timestamp } = body || {};

  if (!sosId || !senderId) {
    return res.status(400).json({ success: false, error: 'Missing required SOS fields: sosId, senderId' });
  }

  // --- Sanitize inputs (prevent injection) ---
  const safeId = String(sosId).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 40);
  const safeSender = String(senderId).replace(/[^a-zA-Z0-9\-_@.]/g, '').slice(0, 50);
  const safePriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(priority) ? priority : 'UNKNOWN';
  const safeMsg = String(message || 'I need help.').replace(/[<>]/g, '').slice(0, 200);
  const safeTime = timestamp
    ? new Date(Number(timestamp)).toUTCString().replace(/GMT$/, 'UTC')
    : new Date().toUTCString().replace(/GMT$/, 'UTC');

  // GPS: only include if valid numeric values
  const gpsText = (typeof latitude === 'number' && typeof longitude === 'number')
    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    : 'Location not available';

  // --- Build WhatsApp Cloud API request ---
  // Uses a pre-approved message template. Template parameters match positionally.
  // Template: "LIFELINE SOS ALERT\nSender: {{1}}\nSOS ID: {{2}}\nPriority: {{3}}\nGPS: {{4}}\nTime: {{5}}\nMessage: {{6}}"
  const useTemplate = process.env.WHATSAPP_MESSAGE_TYPE === 'template';
  const waPayload = useTemplate ? {
    messaging_product: 'whatsapp',
    to: WHATSAPP_RECIPIENT_PHONE,
    type: 'template',
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: safeSender },
            { type: 'text', text: safeId },
            { type: 'text', text: safePriority },
            { type: 'text', text: gpsText },
            { type: 'text', text: safeTime },
            { type: 'text', text: safeMsg },
          ],
        },
      ],
    },
  } : {
    messaging_product: 'whatsapp',
    to: WHATSAPP_RECIPIENT_PHONE,
    type: 'text',
    text: { preview_url: false, body: ['🚨 LIFELINE SOS ALERT', '', 'Sender: ' + safeSender, 'SOS ID: ' + safeId, 'Priority: ' + safePriority, 'Location: ' + gpsText, 'Time: ' + safeTime, 'Message: ' + safeMsg, '', '(Disaster Rescue Mesh Network)'].join('\n') }
  };

  // --- Call WhatsApp Cloud API ---
  try {
    const waResponse = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(waPayload),
      }
    );

    const waData = await waResponse.json();

    if (!waResponse.ok) {
      // Log the error server-side (never expose token or raw Meta error to client)
      console.error('[WhatsApp API] Meta API error:', JSON.stringify(waData));
      const errCode = waData?.error?.code;
      const errType = waData?.error?.type;
      return res.status(502).json({
        success: false,
        error: mapWhatsAppError(errCode, errType),
      });
    }

    console.log(`[WhatsApp API] SOS dispatched: ${safeId} -> ${WHATSAPP_RECIPIENT_PHONE}`);
    return res.status(200).json({
      success: true,
      messageId: waData?.messages?.[0]?.id || null,
      sosId: safeId,
    });

  } catch (networkErr) {
    console.error('[WhatsApp API] Network error calling Meta API:', networkErr?.message);
    return res.status(504).json({
      success: false,
      error: 'Failed to reach WhatsApp notification server. Please try again.',
    });
  }
}

/**
 * Converts Meta WhatsApp API error codes into user-friendly messages.
 * Never exposes raw API errors or tokens.
 */
function mapWhatsAppError(code, type) {
  const codeNum = Number(code);
  if (codeNum === 190) return 'WhatsApp notification service: authentication error. Contact administrator.';
  if (codeNum === 4) return 'WhatsApp notification service: request limit reached. Please wait and try again.';
  if (codeNum === 100 || codeNum === 131030) return 'WhatsApp notification service: invalid recipient. Verify emergency contact number.';
  if (codeNum === 131047) return 'WhatsApp notification service: recipient has not opted in.';
  if (type === 'OAuthException') return 'WhatsApp notification service: authentication failed.';
  return 'WhatsApp notification service: temporary error. SOS has been recorded locally.';
}