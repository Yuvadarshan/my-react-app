// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyATJi8g3YgHL3Aleo6sKKtI60C4Hb1JYgM",
  authDomain: "od-project-2a2f3.firebaseapp.com",
  projectId: "od-project-2a2f3",
  storageBucket: "od-project-2a2f3.firebasestorage.app",
  messagingSenderId: "628812735439",
  appId: "1:628812735439:web:a2e517732ef050aaf368ba",
  measurementId: "G-TV8K12JGYD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;