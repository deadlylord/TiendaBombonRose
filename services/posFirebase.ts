import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const posFirebaseConfig = {
  apiKey: "AIzaSyCsEfJKMRzfOirlzpzPag8hwIyDzEwXicU",
  authDomain: "factura2-6e811.firebaseapp.com",
  databaseURL: "https://factura2-6e811-default-rtdb.firebaseio.com",
  projectId: "factura2-6e811",
  storageBucket: "factura2-6e811.firebasestorage.app",
  messagingSenderId: "1038601908493",
  appId: "1:1038601908493:web:bfcaf3c4312aae287fc044",
  measurementId: "G-1RBDBWCRDW"
};

// Initialize POS Firebase with a unique name
const posApp = getApps().find(app => app.name === 'posApp') || initializeApp(posFirebaseConfig, 'posApp');

export const posDb = getFirestore(posApp);
