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
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar metadata do vídeo"));
  });

  const duration = video.duration || 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const w = video.videoWidth || maxWidth;
  const h = video.videoHeight || Math.round(maxWidth * (9 / 16));

  const outW = Math.min(maxWidth, w);
  const outH = Math.round(outW * (h / w));

  canvas.width = outW;
  canvas.height = outH;

  const safeEnd = Math.max(0.2, duration - 0.2);
  const timesBase = [0.5, 1.5, 3, 5, 7, 9];
  const times = timesBase
    .map((t) => Math.min(Math.max(t, 0.2), safeEnd))
    .slice(0, frameCount);

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

