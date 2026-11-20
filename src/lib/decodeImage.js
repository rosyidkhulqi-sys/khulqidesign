// Reads a picture file into something a canvas can draw. createImageBitmap
// is quickest, but some JPGs it refuses (CMYK exports from Illustrator, very
// large files, especially in Safari: "An error occurred reading the Blob
// argument to createImageBitmap") still open fine as an ordinary <img>, so
// that is the fallback. Either way the result has width, height and close(),
// and goes straight into ctx.drawImage.
export async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // a detached <img> reports its natural size; close() matches ImageBitmap
      img.close = () => URL.revokeObjectURL(url);
      return img;
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("This picture can't be read. Save it again as an RGB JPG and try once more.");
    }
  }
}
