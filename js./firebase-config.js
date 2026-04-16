// =====================================================
// اعدادات Firebase - ملف التهيئة الرئيسي
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove, increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// بيانات اعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCOKwJVTLjxgbW28mHDe24QXpmjV88Yx0M",
    authDomain: "egypt-library-c2e21.firebaseapp.com",
    projectId: "egypt-library-c2e21",
    storageBucket: "egypt-library-c2e21.firebasestorage.app",
    messagingSenderId: "343388641237",
    appId: "1:343388641237:web:ba48f58aec75a9878c0f5c",
    measurementId: "G-9EV0BRVR7G"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// تصدير الخدمات
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// تصدير دوال المساعدة
export { 
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove, increment, writeBatch,
    ref, uploadBytes, getDownloadURL, deleteObject, listAll
};

// توليد كود تعريفي فريد
export function generateInviteCode() {
    return 'EGY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ضغط الصورة قبل الرفع
export function compressImage(file, maxSizeMB = 0.5) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}