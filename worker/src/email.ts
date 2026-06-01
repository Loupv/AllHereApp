/** Email OTP helpers — 6-digit code, hashed at rest, sent via Resend. */

export const generateCode = (): string => {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
};

export const hashCode = async (email: string, code: string): Promise<string> => {
  const data = new TextEncoder().encode(`${email}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const sendOtp = async (env: Env, email: string, code: string): Promise<void> => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: `Your AllHere code: ${code}`,
      text: `Your AllHere verification code is ${code}.\nIt expires in 10 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`resend HTTP ${res.status}`);
};
