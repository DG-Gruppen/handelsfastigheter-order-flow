import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNativeApp } from "./platform";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Sparar en fil åt användaren. I webbläsaren laddas den ner; i Android/iOS-appen
 * (där nedladdningslänkar inte fungerar) öppnas delningsmenyn så att filen kan
 * sparas i Filer/Drive eller öppnas i en annan app.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const path = filename.replace(/[\\/:*?"<>|]+/g, "_");
  const { uri } = await Filesystem.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (error) {
    // Att stänga delningsmenyn räknas som avbrutet, inte som fel.
    if (!/cancel/i.test(String((error as Error)?.message ?? error))) throw error;
  }
}
