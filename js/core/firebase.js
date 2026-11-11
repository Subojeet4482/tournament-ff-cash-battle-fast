/**
 * Firebase bootstrap — AUTH ONLY (register, email login, Google login, password reset).
 * The app has NO direct access to Firestore or Storage any more: every piece of data goes through the load balancer API (js/core/api.js).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, deleteUser, verifyPasswordResetCode, confirmPasswordReset, linkWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCYIDgxy7-WV_a_q1hbqNuzNmqD3ayHMXg",
    authDomain: "database1-ccd73.firebaseapp.com",
    projectId: "database1-ccd73",
    storageBucket: "database1-ccd73.firebasestorage.app",
    messagingSenderId: "905783144633",
    appId: "1:905783144633:web:be664ec42d6d60af7c6b68",
    measurementId: "G-BVDD84YD1N"
};

export const appInstance = initializeApp(firebaseConfig);
export const authService = getAuth(appInstance);

export {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut,
    updateProfile, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, deleteUser, verifyPasswordResetCode, confirmPasswordReset, linkWithCredential
};
