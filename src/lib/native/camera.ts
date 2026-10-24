import { ActionSheet, ActionSheetButtonStyle } from "@capacitor/action-sheet";
import { Camera, MediaTypeSelection } from "@capacitor/camera";

/**
 * Låter användaren ta ett foto eller välja en bild i Android/iOS-appen.
 * Returnerar null om användaren avbryter. Bara för appen; webben använder <input type="file">.
 */
export async function pickImageNative(): Promise<File | null> {
  const { index, canceled } = await ActionSheet.showActions({
    title: "Lägg till bild",
    options: [
      { title: "Ta foto" },
      { title: "Välj från biblioteket" },
      { title: "Avbryt", style: ActionSheetButtonStyle.Cancel },
    ],
  });
  if (canceled || (index !== 0 && index !== 1)) return null;

  try {
    const media =
      index === 0
        ? await Camera.takePhoto({ quality: 85 })
        : (await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, limit: 1 })).results[0];
    if (!media?.webPath) return null;
    const blob = await (await fetch(media.webPath)).blob();
    const type = blob.type || "image/jpeg";
    return new File([blob], `bild-${Date.now()}.${type.split("/")[1] || "jpg"}`, { type });
  } catch (error) {
    // Avbruten kamera/bildväljare ger ett fel från pluginet.
    console.warn("Image picker closed", error);
    return null;
  }
}
