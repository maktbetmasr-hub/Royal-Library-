// =====================================================
// نظام المصادقة - تسجيل الدخول، الضيف، التوثيق
// =====================================================

import { 
    auth, googleProvider, signInWithPopup, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut, onAuthStateChanged,
    updateProfile, db, doc, setDoc, getDoc, updateDoc,
    serverTimestamp, generateInviteCode, compressImage, storage,
    ref, uploadBytes, getDownloadURL, addDoc, collection, query, where, getDocs, increment
} from './firebase-config.js';

// =====================================================
// المتغيرات العامة
// =====================================================
let currentUser = null;
let currentUserData = null;
let isGuestMode = false;
let authListeners = [];
let adminPassword = localStorage.getItem('adminPassword') || 'Admin@2025';

// =====================================================
// دوال مساعدة
// =====================================================
function showMessage(text, type = 'info') {
    let m = document.createElement('div');
    m.textContent = text;
    let bgColor = type === 'error' ? '#930000' : (type === 'success' ? '#1a5c1a' : '#e60000');
    m.className = 'toast-message';
    m.style.background = bgColor;
    m.style.color = '#fff';
    document.body.appendChild(m);
    setTimeout(() => { m.style.opacity = '0'; setTimeout(() => m.remove(), 400); }, 3000);
}

// =====================================================
// دالة إضافة إشعار (تم إكمالها)
// =====================================================
export async function addNotification(userId, text) {
    if (!userId || userId === 'guest') return;
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: userId,
            text: text,
            read: false,
            createdAt: serverTimestamp()
        });
        console.log(`✅ إشعار تم إرساله إلى ${userId}: ${text}`);
    } catch (error) {
        console.error('خطأ في إضافة الإشعار:', error);
    }
}

// =====================================================
// دالة تحديث الصورة الشخصية (تم إكمالها)
// =====================================================
export async function updateProfilePicture(file) {
    if (!currentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'error');
        return null;
    }
    if (!file) return null;
    
    try {
        showMessage('🔄 جاري رفع الصورة...', 'info');
        const compressed = await compressImage(file);
        const fileName = `avatars/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, compressed);
        const url = await getDownloadURL(storageRef);
        
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { photoURL: url });
        if (currentUserData) currentUserData.photoURL = url;
        
        showMessage('✅ تم تحديث الصورة الشخصية بنجاح', 'success');
        return url;
    } catch (error) {
        console.error('خطأ في رفع الصورة:', error);
        showMessage('❌ فشل رفع الصورة', 'error');
        return null;
    }
}

// =====================================================
// دالة تحديث صورة الغلاف (تم إكمالها)
// =====================================================
export async function updateCoverPicture(file) {
    if (!currentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'error');
        return null;
    }
    if (!file) return null;
    
    try {
        showMessage('🔄 جاري رفع الغلاف...', 'info');
        const compressed = await compressImage(file);
        const fileName = `covers/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, compressed);
        const url = await getDownloadURL(storageRef);
        
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { coverURL: url });
        if (currentUserData) currentUserData.coverURL = url;
        
        showMessage('✅ تم تحديث صورة الغلاف بنجاح', 'success');
        return url;
    } catch (error) {
        console.error('خطأ في رفع الغلاف:', error);
        showMessage('❌ فشل رفع الغلاف', 'error');
        return null;
    }
}

// =====================================================
// إنشاء حساب مستخدم جديد
// =====================================================
export async function signUp(name, email, password, inviteCode = null) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        
        const userRef = doc(db, 'users', result.user.uid);
        const newInviteCode = generateInviteCode();
        
        let referredBy = null;
        let points = 0;
        
        if (inviteCode) {
            const codesRef = collection(db, 'inviteCodes');
            const q = query(codesRef, where('code', '==', inviteCode), where('used', '==', false));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const codeDoc = snapshot.docs[0];
                referredBy = codeDoc.data().createdBy;
                await updateDoc(doc(db, 'inviteCodes', codeDoc.id), { 
                    used: true, usedBy: result.user.uid, usedAt: serverTimestamp() 
                });
                points = 50;
                if (referredBy) {
                    const referrerRef = doc(db, 'users', referredBy);
                    await updateDoc(referrerRef, { points: increment(100) });
                    await addNotification(referredBy, `${name} سجل باستخدام كودك! +100 نقطة`);
                }
            }
        }
        
        await setDoc(userRef, {
            uid: result.user.uid, name, email, photoURL: '', coverURL: '',
            role: email === 'admin@egy-library.com' ? 'owner' : 'reader',
            rank: email === 'admin@egy-library.com' ? 'صاحب التطبيق' : 'مبتدئ',
            verified: email === 'admin@egy-library.com',
            followers: [], following: [], booksCount: 0, totalViews: 0,
            bio: 'مرحباً! أنا قارئ وكاتب على المكتبة الملكية',
            inviteCode: newInviteCode, referredBy, points, archivedBooks: [],
            createdAt: serverTimestamp(), lastLogin: serverTimestamp()
        });
        
        await setDoc(doc(db, 'inviteCodes', newInviteCode), {
            code: newInviteCode, createdBy: result.user.uid, used: false, createdAt: serverTimestamp()
        });
        
        showMessage(`🎉 مرحباً ${name}! تم إنشاء حسابك بنجاح`, 'success');
        return { success: true, user: result.user };
    } catch (error) {
        console.error(error);
        let errorMsg = 'حدث خطأ في إنشاء الحساب';
        if (error.code === 'auth/email-already-in-use') errorMsg = 'البريد الإلكتروني مستخدم بالفعل';
        else if (error.code === 'auth/weak-password') errorMsg = 'كلمة السر ضعيفة (6 أحرف على الأقل)';
        showMessage(`❌ ${errorMsg}`, 'error');
        return { success: false, error: errorMsg };
    }
}

// =====================================================
// تسجيل الدخول بالبريد وكلمة السر
// =====================================================
export async function signIn(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await updateDoc(doc(db, 'users', result.user.uid), { lastLogin: serverTimestamp() });
        showMessage(`🎉 مرحباً بعودتك!`, 'success');
        return { success: true, user: result.user };
    } catch (error) {
        console.error(error);
        let errorMsg = 'فشل تسجيل الدخول';
        if (error.code === 'auth/user-not-found') errorMsg = 'لا يوجد حساب بهذا البريد';
        else if (error.code === 'auth/wrong-password') errorMsg = 'كلمة السر غير صحيحة';
        else if (error.code === 'auth/invalid-email') errorMsg = 'البريد الإلكتروني غير صالح';
        showMessage(`❌ ${errorMsg}`, 'error');
        return { success: false, error: errorMsg };
    }
}

// =====================================================
// تسجيل الدخول بحساب Google
// =====================================================
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            const newInviteCode = generateInviteCode();
            await setDoc(userRef, {
                uid: result.user.uid, name: result.user.displayName, email: result.user.email,
                photoURL: result.user.photoURL || '', coverURL: '', role: 'reader', rank: 'مبتدئ',
                verified: false, followers: [], following: [], booksCount: 0, totalViews: 0,
                bio: 'مرحباً! أنا قارئ وكاتب على المكتبة الملكية', inviteCode: newInviteCode,
                archivedBooks: [], createdAt: serverTimestamp(), lastLogin: serverTimestamp(), points: 0
            });
            await setDoc(doc(db, 'inviteCodes', newInviteCode), {
                code: newInviteCode, createdBy: result.user.uid, used: false, createdAt: serverTimestamp()
            });
        } else {
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
        
        showMessage(`🎉 مرحباً ${result.user.displayName}!`, 'success');
        return { success: true, user: result.user };
    } catch (error) {
        console.error(error);
        showMessage('❌ حدث خطأ في تسجيل الدخول بحساب Google', 'error');
        return { success: false, error: error.message };
    }
}

// =====================================================
// تسجيل الخروج
// =====================================================
export async function logout() {
    try {
        await signOut(auth);
        isGuestMode = false;
        currentUser = null;
        currentUserData = null;
        showMessage('👋 تم تسجيل الخروج', 'success');
        return { success: true };
    } catch (error) {
        console.error(error);
        showMessage('❌ حدث خطأ', 'error');
        return { success: false };
    }
}

// =====================================================
// وضع الضيف (Guest Mode)
// =====================================================
export function enterGuestMode() {
    isGuestMode = true;
    currentUser = null;
    currentUserData = {
        uid: 'guest', name: 'زائر كريم', role: 'guest', rank: 'ضيف', verified: false,
        photoURL: '', coverURL: '', bio: 'أنا ضيف في المكتبة الملكية - أقرأ فقط'
    };
    showMessage('👋 مرحباً بك ضيفاً! يمكنك القراءة فقط', 'info');
    authListeners.forEach(listener => listener(true, currentUserData, true));
    return { success: true };
}

// =====================================================
// دوال أخرى
// =====================================================
export function isGuest() { return isGuestMode || currentUserData?.role === 'guest'; }
export function isLoggedIn() { return !isGuestMode && currentUser !== null; }
export function getCurrentUser() { return currentUser; }
export function getCurrentUserData() { return currentUserData; }
export function getAdminPassword() { return adminPassword; }

export async function updateUserData(uid, updates) {
    if (!uid || uid === 'guest') return false;
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, updates);
        if (currentUserData && currentUserData.uid === uid) {
            currentUserData = { ...currentUserData, ...updates };
        }
        return true;
    } catch (error) { console.error(error); return false; }
}

export async function changeUserRank(userId, newRank, currentAdmin) {
    if (currentAdmin?.role !== 'owner') return false;
    try {
        const userRef = doc(db, 'users', userId);
        const updates = { rank: newRank };
        if (newRank === 'صاحب التطبيق') {
            updates.role = 'owner';
            updates.verified = true;
        } else if (newRank === 'كاتب جامد' || newRank === 'أسطوري') {
            updates.role = 'writer';
            updates.verified = true;
        } else {
            updates.role = 'reader';
            updates.verified = false;
        }
        await updateDoc(userRef, updates);
        showMessage(`✅ تم تغيير الرتبة`, 'success');
        return true;
    } catch (error) { console.error(error); return false; }
}

export async function changeAdminPassword(oldPassword, newPassword) {
    if (oldPassword !== adminPassword) {
        showMessage('❌ كلمة السر الحالية غير صحيحة', 'error');
        return false;
    }
    if (newPassword.length < 6) {
        showMessage('⚠️ كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return false;
    }
    adminPassword = newPassword;
    localStorage.setItem('adminPassword', adminPassword);
    showMessage('✅ تم تغيير كلمة سر الأدمن بنجاح', 'success');
    return true;
}

export function verifyAdminPassword(password) {
    return password === adminPassword;
}

export function initAuthListener(callback) {
    if (callback) authListeners.push(callback);
    
    onAuthStateChanged(auth, async (user) => {
        if (user && !isGuestMode) {
            currentUser = user;
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUserData = userSnap.data();
                currentUserData.uid = user.uid;
            }
            authListeners.forEach(listener => listener(true, currentUserData, false));
        } else if (!isGuestMode) {
            currentUser = null;
            currentUserData = null;
            authListeners.forEach(listener => listener(false, null, false));
        }
    });
}

export function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

export function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

// ربط دوال رفع الصور بالنافذة
window.updateProfilePicture = updateProfilePicture;
window.updateCoverPicture = updateCoverPicture;

export default {
    signUp, signIn, signInWithGoogle, logout, enterGuestMode,
    updateProfilePicture, updateCoverPicture,
    changeAdminPassword, verifyAdminPassword, getAdminPassword,
    isGuest, isLoggedIn, getCurrentUser, getCurrentUserData,
    initAuthListener, showLoginModal, closeLoginModal, addNotification, updateUserData, changeUserRank
};