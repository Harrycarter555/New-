import { auth, db } from '../firebase';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, updateDoc, increment } from 'firebase/firestore';

export class FirebaseErrorHandler {
  static getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Account not found. Please sign up first.';
      case 'auth/wrong-password':
        return 'Incorrect password. Try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      case 'auth/email-already-in-use':
        return 'Email already registered. Please login.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'firestore/permission-denied':
        return 'Permission denied. Contact admin.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  }

  static handleError(error: any, showToast: (msg: string, type: 'success' | 'error') => void) {
    const message = this.getErrorMessage(error);
    showToast(message, 'error');
    console.error('Firebase Error:', error);
  }
}

export const updateUserWallet = async (
  userId: string,
  amount: number,
  type: 'add' | 'subtract'
) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      walletBalance: type === 'add' ? increment(amount) : increment(-amount),
      totalEarnings: type === 'add' ? increment(amount) : increment(0),
    });
    return true;
  } catch (error) {
    throw error;
  }
};

export const secureLogout = async () => {
  try {
    await signOut(auth);
    localStorage.clear();
    sessionStorage.clear();
    return true;
  } catch (error) {
    throw error;
  }
};
