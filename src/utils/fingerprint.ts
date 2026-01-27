async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeVideoFingerprint(params: {
  platform: string;
  duration: number;
  hook: string;
  description: string;
  frames: string[];
}): Promise<string> {
  const payload = JSON.stringify({
    v: 1,
    platform: params.platform,
    duration: params.duration,
    hook: params.hook.trim(),
    description: params.description.trim(),
    frames: params.frames.map((f) => f.slice(0, 2000))
  });

  return sha256(payload);
}
