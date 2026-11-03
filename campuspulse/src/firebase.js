import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLvvmv-kmQTH8pKoHNB_tSnsWO-reIB6c",
  authDomain: "campuspulse-42839.firebaseapp.com",
  projectId: "campuspulse-42839",
  storageBucket: "campuspulse-42839.firebasestorage.app",
  messagingSenderId: "295057605526",
  appId: "1:295057605526:web:fed19856c60d7bde55d3b7",
  measurementId: "G-1NFVCHLS06"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);