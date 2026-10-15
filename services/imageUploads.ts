import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { auth } from './firebase';

export const uploadImageToStorage = async (file: File, optimizeBanner = false): Promise<string> => {
    if (optimizeBanner && typeof createImageBitmap === 'function' && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
        const bitmap = await createImageBitmap(file);
        try {
            const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('No se pudo preparar la imagen.');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.86));
            if (blob && (blob.size < file.size || scale < 1)) {
                file = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type });
            }
        } finally { bitmap.close(); }
    }
    const fileName = `images/${Date.now()}-${file.name}`;
    const storageRef = ref(getStorage(auth.app), fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

