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

  // Define tamanho mantendo proporção
  const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
  canvas.width = Math.min(maxWidth, video.videoWidth || maxWidth);
  canvas.height = Math.round(canvas.width * ratio);

  const frames: string[] = [];

  // timestamps distribuídos (evita 0s e o fim)
  const safeStart = Math.min(0.2, Math.max(0, duration * 0.05));
  const safeEnd = Math.max(0, duration - 0.2);
  const span = Math.max(0.1, safeEnd - safeStart);

  for (let i = 0; i < frameCount; i++) {
    const t = safeStart + (span * (i + 1)) / (frameCount + 1);

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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    frames.push(dataUrl);
  }

  URL.revokeObjectURL(url);
  return { frames, duration };
}

