/**
 * Firebase bootstrap — AUTH ONLY (register, email login, Google login, password reset).
 * The app has NO direct access to Firestore or Storage any more: every piece of data goes through the load balancer API (js/core/api.js).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, deleteUser, verifyPasswordResetCode, confirmPasswordReset, linkWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA1DJ5TQaK8HxasfTwKHNTxgNPHRCy4KRY",
    authDomain: "tournament-e8da7.firebaseapp.com",
    projectId: "tournament-e8da7",
    storageBucket: "tournament-e8da7.firebasestorage.app",
    messagingSenderId: "461449506021",
    appId: "1:461449506021:web:93cab101e9d382f8a2f80c"
};

export const appInstance = initializeApp(firebaseConfig);
export const authService = getAuth(appInstance);

export {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut,
    updateProfile, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, deleteUser, verifyPasswordResetCode, confirmPasswordReset, linkWithCredential
};
