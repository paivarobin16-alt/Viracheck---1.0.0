export async function extractFramesFromVideoFile(
  file: File,
  frameCount = 5,
  maxWidth = 640
): Promise<{ frames: string[]; duration: number }> {
  const url = URL.createObjectURL(file);

  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar metadata do vídeo"));
  });

  const duration = Number.isFinite(video.duration) ? video.duration : 0;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const vw = video.videoWidth || maxWidth;
  const vh = video.videoHeight || Math.round(maxWidth * (9 / 16));

  const outW = Math.min(maxWidth, vw);
  const outH = Math.round(outW * (vh / vw));
  canvas.width = outW;
  canvas.height = outH;

  const safeEnd = Math.max(0.2, duration - 0.2);
  const times = Array.from({ length: frameCount }, (_, i) => {
    const t = (safeEnd / (frameCount + 1)) * (i + 1);
    return Math.min(Math.max(t, 0.2), safeEnd);
  });

  const frames: string[] = [];

  for (const t of times) {
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("error", onError);
        reject(new Error("Falha ao buscar frame"));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = t;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.8));
  }

  URL.revokeObjectURL(url);
  return { frames, duration };
}
