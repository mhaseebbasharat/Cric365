// Reads a picked file into an <img>. Uses a data URL (not a temporary blob URL) so the picture
// stays valid for the crop preview as well as for drawing the final cropped image.
export const loadImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that image'));
  reader.onload = () => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
