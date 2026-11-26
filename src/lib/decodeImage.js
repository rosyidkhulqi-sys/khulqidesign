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
      // waits for the load itself: Safari's decode() rejects some big photos
      // (48 MP iPhone shots, for one) that still load and draw fine
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      if (!img.naturalWidth) throw new Error("empty");
      // a detached <img> reports its natural size; close() matches ImageBitmap
      img.close = () => URL.revokeObjectURL(url);
      return img;
    } catch {
      URL.revokeObjectURL(url);
      // a file moved, renamed or edited after it was added can't be read at
      // all any more; that's not the picture's fault
      const readable = await file.slice(0, 16).arrayBuffer().then(() => true, () => false);
      if (!readable) throw new Error("This file was moved or changed after it was added. Remove it and add it again from its folder.");
      throw new Error("This picture can't be read. Save it again as an RGB JPG and try once more.");
    }
  }
}
