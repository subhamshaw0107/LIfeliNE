/**
 * LIFELINE - WhatsApp Notification Service (Frontend)
 *
 * This module calls the SECURE serverless backend (/api/whatsapp-sos).
 * It does NOT contain any WhatsApp API tokens or secrets.
 * All credentials live in Vercel environment variables on the server.
 *
 * Environment variable required in .env (frontend only, NOT secret):
 *   VITE_WHATSAPP_API_URL  - URL of the serverless backend
 *     For Vercel deployment: leave blank (defaults to /api/whatsapp-sos relative)
 *     For GitHub Pages:      set to your Vercel deployment URL, e.g.:
 *                            https://life-line-subhamshaw0107s-projects.vercel.app/api/whatsapp-sos
 */

export interface WhatsAppSosPayload {
  sosId: string;
  senderId: string;
  latitude?: number;
  longitude?: number;
  priority?: string;
  message?: string;
  timestamp?: number;
}

export interface WhatsAppSosResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Resolve API endpoint from Vite env or fall back to relative path (Vercel only)
const WHATSAPP_API_URL: string =
  (import.meta.env.VITE_WHATSAPP_API_URL as string) || '/api/whatsapp-sos';

/**
 * Sends an SOS alert via WhatsApp using the secure serverless backend.
 * Never throws — always returns a result object.
 */
export async function sendWhatsAppSosAlert(
  payload: WhatsAppSosPayload
): Promise<WhatsAppSosResult> {
  // Validate required fields
  if (!payload.sosId || !payload.senderId) {
    return { success: false, error: 'Invalid SOS payload: missing sosId or senderId.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sosId: payload.sosId,
        senderId: payload.senderId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        priority: payload.priority,
        message: payload.message,
        timestamp: payload.timestamp ?? Date.now(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data: WhatsAppSosResult;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: 'WhatsApp service returned an unreadable response.' };
    }

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'WhatsApp notification could not be delivered.',
      };
    }

    return { success: true, messageId: data.messageId };

  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'WhatsApp notification timed out. SOS is still active locally.' };
    }
    if (err instanceof TypeError) {
      return { success: false, error: 'Network error: Could not reach WhatsApp notification server.' };
    }
    return { success: false, error: 'Unexpected error while sending WhatsApp alert.' };
  }
}