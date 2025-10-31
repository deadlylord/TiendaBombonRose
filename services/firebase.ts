// Fix: The code has been updated to use the correct Firebase v9+ modular SDK. The errors reported suggest that an older version of Firebase might be installed in the project's dependencies. Please ensure you are using Firebase version 9 or newer.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

// Initialize Firebase, preventing re-initialization in a hot-reload environment.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get a reference to the database service
export const db = getFirestore(app);

// Get a reference to the storage service
export const storage = getStorage(app);

// Get a reference to the auth service
export const auth = getAuth(app);
