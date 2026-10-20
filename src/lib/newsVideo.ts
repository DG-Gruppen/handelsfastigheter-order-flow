import { Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

export const NEWS_VIDEO_BUCKET = "news-videos";
export const NEWS_VIDEO_MAX_BYTES = 500 * 1024 * 1024;

export function validateNewsVideo(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!/\.mp4$/i.test(file.name) || (file.type && file.type !== "video/mp4")) return "Välj en MP4-fil.";
  if (file.size === 0) return "Videofilen är tom.";
  if (file.size > NEWS_VIDEO_MAX_BYTES) return "Videon får vara högst 500 MB.";
  return null;
}

export async function uploadNewsVideo(file: File, userId: string, onProgress: (percent: number) => void): Promise<string> {
  const validation = validateNewsVideo(file);
  if (validation) throw new Error(validation);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Logga in igen för att ladda upp videon.");
  const path = `${userId}/${crypto.randomUUID()}.mp4`;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      headers: { authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: NEWS_VIDEO_BUCKET, objectName: path, contentType: "video/mp4", cacheControl: "3600" },
      onProgress: (uploaded, total) => onProgress(Math.round(uploaded / total * 100)),
      onSuccess: () => resolve(),
      onError: () => reject(new Error("Videon kunde inte laddas upp. Kontrollera anslutningen och försök igen.")),
    });
    upload.start();
  });
  return path;
}