// =====================================================
// الملف الرئيسي - تشغيل وتجميع الموقع
// =====================================================

import { loadBooks } from './db.js';
import { 
    initAuthListener, isGuest, logout, changeUserRank, showLoginModal, closeLoginModal,
    changeAdminPassword, updateProfilePicture, updateCoverPicture
} from './auth.js';
import { 
    renderHomePage, renderTrendingPage, renderProfilePage, renderWritePage,
    navigateTo, openReader, increaseFont, decreaseFont, likeCurrentBook,
    renderAdminPage, downloadCurrentBook, handleAvatarUpload, handleCoverUpload
} from './ui.js';
import { publishBook, deleteBook, toggleLike, toggleFollow, updateBook, downloadBookAsText } from './db.js';

// =====================================================
// ربط الدوال بالنافذة
// =====================================================
window.navigateTo = navigateTo;
window.openReader = openReader;
window.increaseFont = increaseFont;
window.decreaseFont = decreaseFont;
window.likeCurrentBook = likeCurrentBook;
window.publishNewBook = publishBook;
window.deleteBook = deleteBook;
window.toggleLike = toggleLike;
window.toggleFollow = toggleFollow;
window.logoutUser = logout;
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.changeUserRank = changeUserRank;
window.downloadCurrentBook = downloadCurrentBook;
window.handleAvatarUpload = handleAvatarUpload;
window.handleCoverUpload = handleCoverUpload;
window.changeAdminPassword = changeAdminPassword;

// =====================================================
// البحث المباشر
// =====================================================
let searchTimeout;
document.getElementById('globalSearch')?.addEventListener('input', () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (document.getElementById('homePage').classList.contains('active-page')) {
            renderHomePage();
        }
    }, 500);
});

// =====================================================
// أزرار التنقل
// =====================================================
document.getElementById('userMenuBtn')?.addEventListener('click', () => {
    if (isGuest()) {
        showLoginModal();
    } else {
        navigateTo('profile');
    }
});

document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', () => {
        const page = nav.getAttribute('data-page');
        if (page === 'write' && isGuest()) {
            showLoginModal();
            return;
        }
        navigateTo(page);
    });
});

// ربط أزرار نافذة تسجيل الدخول
document.getElementById('loginBtn')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (email && password) signIn(email, password);
});

document.getElementById('signupBtn')?.addEventListener('click', () => {
    const name = document.getElementById('loginName').value;
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const inviteCode = document.getElementById('loginInviteCode').value;
    if (name && email && password) signUp(name, email, password, inviteCode);
});

document.getElementById('googleBtn')?.addEventListener('click', () => signInWithGoogle());
document.getElementById('guestBtn')?.addEventListener('click', () => { enterGuestMode(); closeLoginModal(); });
document.getElementById('closeLoginModal')?.addEventListener('click', () => closeLoginModal());

// =====================================================
// إظهار زر الأدمن للمستخدم المالك
// =====================================================
function checkAdminNav() {
    const currentUserData = window.getCurrentUserData?.();
    if (currentUserData?.role === 'owner') {
        document.getElementById('adminNavItem').style.display = 'flex';
    } else {
        document.getElementById('adminNavItem').style.display = 'none';
    }
}

// =====================================================
// تهيئة الموقع
// =====================================================
async function initApp() {
    console.log('🚀 EGY-LIBRARY - التشغيل...');
    
    await loadBooks();
    
    initAuthListener(async (isLoggedIn, userData, isGuestMode) => {
        checkAdminNav();
        if (document.getElementById('homePage').classList.contains('active-page')) {
            await renderHomePage();
        } else if (document.getElementById('profilePage').classList.contains('active-page')) {
            await renderProfilePage();
        }
    });
    
    await navigateTo('home');
    console.log('✅ الموقع جاهز!');
}

initApp();