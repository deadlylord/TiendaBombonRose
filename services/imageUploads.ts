import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { auth } from './firebase';

export const uploadImageToStorage = async (file: File): Promise<string> => {
    const fileName = `images/${Date.now()}-${file.name}`;
    const storageRef = ref(getStorage(auth.app), fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

