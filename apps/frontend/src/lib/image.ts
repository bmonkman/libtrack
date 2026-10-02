// Phone photos are often 12+ megapixels; the API caps uploads and the model doesn't need that
// much detail. Shrinks so the longer side is at most maxSide and re-encodes as JPEG.
export async function photoToJpegBase64(
	file: File,
	maxSide = 1600,
	quality = 0.85
): Promise<{ data: string; mimeType: 'image/jpeg' }> {
	// imageOrientation applies the phone's rotation flag, so portrait photos stay upright
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	const dataUrl = canvas.toDataURL('image/jpeg', quality);
	return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
