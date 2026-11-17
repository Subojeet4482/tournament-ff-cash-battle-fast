/**
 * Second Firebase project used ONLY for the Proofs feed (database1-ccd73).
 * Anonymous sign-in is used there (Console -> Authentication -> Sign-in method -> Anonymous -> Enable).
 * Rules: proofs-project.rules
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, limit, where, writeBatch, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCYIDgxy7-WV_a_q1hbqNuzNmqD3ayHMXg",
    authDomain: "database1-ccd73.firebaseapp.com",
    projectId: "database1-ccd73",
    storageBucket: "database1-ccd73.firebasestorage.app",
    messagingSenderId: "905783144633",
    appId: "1:905783144633:web:be664ec42d6d60af7c6b68"
};
const app = initializeApp(firebaseConfig, 'proofs');
export const pAuth = getAuth(app);
export const pdb = getFirestore(app);
/** Needed before any write (reads are public). Resolves to this device's anonymous uid. */
export async function ensureAnon() {
    if (pAuth.currentUser) return pAuth.currentUser.uid;
    const c = await signInAnonymously(pAuth); return c.user.uid;
}
export { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, limit, where, writeBatch, increment };
