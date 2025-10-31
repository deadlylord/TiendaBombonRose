// Fix: Changed named imports from 'firebase/app' to a namespace import
// to address potential module resolution issues.
import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

// Initialize Firebase, preventing re-initialization in a hot-reload environment
const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();

// Get a reference to the database service
export const db = getFirestore(app);

// Get a reference to the storage service
export const storage = getStorage(app);

// Get a reference to the auth service
export const auth = getAuth(app);