import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDH90mXfvaWB_DKbF3wrq4WFtemyu7XUqw",
  authDomain: "ptw-weightlifting.firebaseapp.com",
  projectId: "ptw-weightlifting",
  storageBucket: "ptw-weightlifting.firebasestorage.app",
  messagingSenderId: "565724255150",
  appId: "1:565724255150:web:e5e0a982ec44b22cecee3f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
