import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const setInitialPassword = async (email, tempPassword, newPassword) => {
  try {
    // First try to login with temporary password
    const loginResult = await loginUser(email, tempPassword);
    
    if (!loginResult.success) {
      return loginResult;
    }
    
    // Update password
    await updatePassword(loginResult.user, newPassword);
    
    // Update Firestore to mark password as set
    await setDoc(doc(db, 'users', email), {
      passwordSet: true
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};