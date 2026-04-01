export const isDataUrl = (url: string) => url.startsWith("data:");

export const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Cannot read file"));
      }
    };
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });

export const compressImageDataUrl = (
  dataUrl: string,
  maxWidth = 1600,
  quality = 0.82,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Decode image failed"));
    image.src = dataUrl;
  });

export const parseYouTubeId = (url: string): string | null => {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id || null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.replace("/shorts/", "");
        return id || null;
      }

      const watchId = parsed.searchParams.get("v");
      if (watchId) {
        return watchId;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.replace("/embed/", "");
        return id || null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const buildYoutubeEmbedUrl = (input: string): string | null => {
  const id = parseYouTubeId(input);
  if (!id) {
    return null;
  }
  return `https://www.youtube.com/embed/${id}`;
};
