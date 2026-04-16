// =====================================================
// واجهة المستخدم - عرض الصفحات والتفاعلات
// =====================================================

import { 
    loadBooks, getBookById, publishBook, updateBook, deleteBook, incrementView,
    toggleLike, toggleFollow, searchBooks, getTrendingBooks, getUserBooks,
    getAllUsers, categories, booksCache, uploadBookCover, downloadBookAsText
} from './db.js';
import { 
    getCurrentUser, getCurrentUserData, isGuest, isLoggedIn, 
    logout, updateUserData, changeUserRank, showLoginModal, closeLoginModal,
    updateProfilePicture, updateCoverPicture, changeAdminPassword, verifyAdminPassword
} from './auth.js';

// =====================================================
// المتغيرات العامة
// =====================================================
let currentPage = 'home';
let currentBook = null;
let searchTimeout = null;
let fontSize = parseFloat(localStorage.getItem('readerFontSize')) || 1.2;

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
// عرض الصفحة الرئيسية
// =====================================================
export async function renderHomePage() {
    const container = document.getElementById('shelvesContainer');
    if (!container) return;
    
    const searchTerm = document.getElementById('globalSearch')?.value.toLowerCase() || '';
    let filteredBooks = await searchBooks(searchTerm);
    
    if (filteredBooks.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding:80px;"><i class="fas fa-search fa-3x" style="color:#e60000;opacity:0.5;"></i><p style="margin-top:15px;">لا توجد نتائج بحث</p></div>';
        return;
    }
    
    let booksByCategory = {};
    categories.forEach(cat => {
        if (cat !== 'الكل') {
            booksByCategory[cat] = filteredBooks.filter(b => b.category === cat && !b.isArchived);
        }
    });
    
    let html = '';
    for (let cat of categories) {
        if (cat === 'الكل') continue;
        let catBooks = booksByCategory[cat];
        if (catBooks && catBooks.length > 0) {
            html += `
                <div class="shelf">
                    <div class="shelf-header">
                        <h2><i class="fas fa-layer-group"></i> ${cat}</h2>
                        <a href="#" onclick="window.navigateTo('trending'); return false;">عرض الكل <i class="fas fa-arrow-left"></i></a>
                    </div>
                    <div class="shelf-scroll">
                        ${catBooks.map(book => `
                            <div class="book-card" onclick="window.openReader('${book.id}')">
                                <div class="book-cover">
                                    ${book.cover ? `<img src="${book.cover}" alt="${book.title}">` : `<i class="fas fa-book-open"></i>`}
                                </div>
                                <h3>${book.title}</h3>
                                <p>${book.author}</p>
                                <div class="book-stats">
                                    <span><i class="fas fa-eye"></i> ${book.views || 0}</span>
                                    <span><i class="fas fa-heart"></i> ${book.likes?.length || 0}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

// =====================================================
// عرض صفحة التريند
// =====================================================
export async function renderTrendingPage() {
    const container = document.getElementById('trendingPage');
    const trendingBooks = getTrendingBooks(30);
    
    container.innerHTML = `
        <div class="trending-list">
            <h2 class="text-center" style="color:#e60000; margin:30px 0 20px;"><i class="fas fa-fire"></i> الأكثر مشاهدة</h2>
            ${trendingBooks.map((book, index) => `
                <div class="trending-item" onclick="window.openReader('${book.id}')">
                    <div class="rank-number ${index === 0 ? 'rank-1' : (index === 1 ? 'rank-2' : (index === 2 ? 'rank-3' : 'rank-other'))}">
                        ${index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `#${index+1}`))}
                    </div>
                    <div style="flex:1;">
                        <h3 style="color:#fff;">${book.title}</h3>
                        <p>${book.author} | <i class="fas fa-eye"></i> ${book.views || 0} | <i class="fas fa-heart"></i> ${book.likes?.length || 0}</p>
                    </div>
                    <i class="fas fa-chevron-left" style="color:#e60000;"></i>
                </div>
            `).join('')}
        </div>
    `;
}

// =====================================================
// عرض صفحة الملف الشخصي
// =====================================================
export async function renderProfilePage() {
    const container = document.getElementById('profilePage');
    const currentUserData = getCurrentUserData();
    const isGuestUser = isGuest();
    
    if (!currentUserData && !isGuestUser) {
        container.innerHTML = `<div class="text-center" style="padding:80px;"><i class="fas fa-user-slash fa-3x"></i><p style="margin-top:15px;">الرجاء تسجيل الدخول</p><button class="btn btn-primary mt-20" onclick="window.showLoginModal()">تسجيل الدخول</button></div>`;
        return;
    }
    
    if (isGuestUser) {
        container.innerHTML = `
            <div class="text-center" style="padding:80px;">
                <i class="fas fa-user-friends fa-3x" style="color:#e60000;"></i>
                <h2 style="color:#fff; margin:15px 0;">أنت في وضع الضيف</h2>
                <p style="margin-bottom:25px;">سجل دخولك للاستمتاع بجميع الميزات</p>
                <button class="btn btn-primary" onclick="window.showLoginModal()"><i class="fas fa-sign-in-alt"></i> تسجيل الدخول</button>
            </div>
        `;
        return;
    }
    
    const userBooks = getUserBooks(currentUserData.uid);
    
    container.innerHTML = `
        <div class="cover-area" onclick="document.getElementById('coverInput').click()">
            ${currentUserData.coverURL ? `<img src="${currentUserData.coverURL}" alt="cover">` : '<div style="height:100%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-camera" style="font-size:2rem; color:#e60000;"></i><span>اضغط لتغيير الغلاف</span></div>'}
            <div class="cover-overlay"><i class="fas fa-camera"></i> تغيير الغلاف</div>
        </div>
        <input type="file" id="coverInput" accept="image/*" style="display:none" onchange="window.handleCoverUpload(this.files[0])">
        <div class="profile-avatar" onclick="document.getElementById('avatarInput').click()">
            ${currentUserData.photoURL ? `<img src="${currentUserData.photoURL}" alt="avatar">` : `<i class="fas fa-user-circle"></i>`}
        </div>
        <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="window.handleAvatarUpload(this.files[0])">
        <div class="profile-info">
            <div class="profile-name">
                <h2>${currentUserData.name}</h2>
                ${currentUserData.verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                <span class="rank-badge">${currentUserData.rank || 'قارئ'}</span>
            </div>
            <p style="margin:10px 0; color:#888;">${currentUserData.bio || 'مرحباً! أنا قارئ وكاتب على المكتبة الملكية'}</p>
            <div class="stats-row">
                <div class="stat-card"><h3>${currentUserData.booksCount || 0}</h3><p>الكتب المنشورة</p></div>
                <div class="stat-card"><h3>${currentUserData.followers?.length || 0}</h3><p>المتابعين</p></div>
                <div class="stat-card"><h3>${currentUserData.following?.length || 0}</h3><p>يتابع</p></div>
                <div class="stat-card"><h3>${currentUserData.totalViews || 0}</h3><p>إجمالي المشاهدات</p></div>
            </div>
            <button class="btn" onclick="window.logoutUser()"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>
            <div class="invite-code-box">
                <p><i class="fas fa-gift"></i> كود الدعوة الخاص بك:</p>
                <code>${currentUserData.inviteCode || 'جاري التحميل...'}</code>
                <p style="font-size:0.7rem; margin-top:8px;">كل من يسجل باستخدام كودك يمنحك 100 نقطة!</p>
            </div>
        </div>
        <div style="padding:20px;">
            <h3 style="color:#e60000; margin-bottom:15px;"><i class="fas fa-book"></i> أعمالي (${userBooks.length})</h3>
            <div class="shelf-scroll">
                ${userBooks.map(book => `
                    <div class="book-card" onclick="window.openReader('${book.id}')">
                        <div class="book-cover">${book.cover ? `<img src="${book.cover}">` : `<i class="fas fa-book-open"></i>`}</div>
                        <h3>${book.title}</h3>
                        <p>${book.views || 0} مشاهدة</p>
                        ${book.isArchived ? '<span style="color:#e60000; font-size:0.7rem;">📦 مؤرشف</span>' : ''}
                        <button class="btn btn-sm btn-danger" style="margin-top:8px;" onclick="event.stopPropagation();window.deleteBook('${book.id}')">حذف</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// =====================================================
// عرض صفحة النشر
// =====================================================
export function renderWritePage() {
    const container = document.getElementById('writePage');
    container.innerHTML = `
        <div class="write-form">
            <h2 class="text-center" style="color:#e60000; margin-bottom:30px;"><i class="fas fa-feather-alt"></i> اكتب رواية جديدة</h2>
            <input type="text" id="bookTitle" class="input-pill" placeholder="عنوان الرواية *">
            <select id="bookCategory" class="input-pill">
                ${categories.filter(c => c !== 'الكل').map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <div style="margin-bottom:20px;">
                <button class="btn btn-outline" id="uploadCoverBtn" style="width:100%;"><i class="fas fa-cloud-upload-alt"></i> رفع صورة الغلاف</button>
                <input type="file" id="coverFileInput" accept="image/*" style="display:none">
                <div id="coverPreview" style="margin-top:10px; text-align:center;"></div>
            </div>
            <textarea id="bookContent" class="input-pill" placeholder="محتوى الرواية... *" style="min-height:300px;"></textarea>
            <button class="btn btn-primary" style="width:100%" onclick="window.publishNewBook()"><i class="fas fa-paper-plane"></i> نشر الرواية</button>
        </div>
    `;
    
    let selectedCoverFile = null;
    document.getElementById('uploadCoverBtn').onclick = () => document.getElementById('coverFileInput').click();
    document.getElementById('coverFileInput').onchange = (e) => {
        if (e.target.files[0]) {
            selectedCoverFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('coverPreview').innerHTML = `<img src="${ev.target.result}" style="max-width:150px; border-radius:15px;">`;
            };
            reader.readAsDataURL(selectedCoverFile);
        }
    };
    window.publishNewBook = async () => {
        const title = document.getElementById('bookTitle').value;
        const category = document.getElementById('bookCategory').value;
        const content = document.getElementById('bookContent').value;
        if (!title || !category || !content) {
            showMessage('⚠️ الرجاء ملء جميع الحقول', 'error');
            return;
        }
        const result = await publishBook({ title, category, content }, selectedCoverFile);
        if (result.success) {
            document.getElementById('bookTitle').value = '';
            document.getElementById('bookContent').value = '';
            document.getElementById('coverPreview').innerHTML = '';
            selectedCoverFile = null;
            await loadBooks();
            navigateTo('home');
        }
    };
}

// =====================================================
// عرض صفحة القراءة
// =====================================================
export async function renderReaderPage() {
    const container = document.getElementById('readerPage');
    if (!currentBook) {
        navigateTo('home');
        return;
    }
    
    const isLiked = currentBook.likes?.includes(getCurrentUser()?.uid);
    const isGuestUser = isGuest();
    
    container.innerHTML = `
        <div class="reader-container">
            <h1 class="reader-title">${currentBook.title}</h1>
            <p class="reader-author">✍️ ${currentBook.author} | <i class="fas fa-eye"></i> ${currentBook.views || 0} مشاهدة</p>
            <div id="readerContent" class="reader-content" style="font-size:${fontSize}rem;">${(currentBook.content || '').replace(/\n/g, '<br>')}</div>
            <div class="flex-center gap-10 mt-20">
                <button class="btn btn-sm" onclick="window.downloadCurrentBook()"><i class="fas fa-download"></i> تحميل الكتاب</button>
            </div>
        </div>
        <div class="reader-controls">
            <button onclick="window.scrollTo({top:0,behavior:'smooth'})"><i class="fas fa-arrow-up"></i></button>
            <button onclick="window.decreaseFont()"><i class="fas fa-minus"></i></button>
            <button onclick="window.increaseFont()"><i class="fas fa-plus"></i></button>
            ${!isGuestUser ? `<button id="readerLikeBtn" class="like-btn ${isLiked ? 'liked' : ''}" onclick="window.likeCurrentBook()"><i class="fas fa-heart"></i></button>` : '<button style="opacity:0.5;" disabled><i class="fas fa-heart"></i></button>'}
            <button onclick="window.navigateTo('home')"><i class="fas fa-home"></i></button>
        </div>
    `;
    
    await incrementView(currentBook.id);
}

// =====================================================
// عرض صفحة الأدمن
// =====================================================
export async function renderAdminPage() {
    const container = document.getElementById('adminPage');
    const currentUserData = getCurrentUserData();
    
    if (currentUserData?.role !== 'owner') {
        navigateTo('profile');
        showMessage('غير مصرح لك بالدخول إلى لوحة التحكم', 'error');
        return;
    }
    
    const password = prompt('🔐 أدخل كلمة سر الأدمن للدخول إلى لوحة التحكم:');
    if (!verifyAdminPassword(password)) {
        showMessage('❌ كلمة السر غير صحيحة', 'error');
        navigateTo('profile');
        return;
    }
    
    const allUsers = await getAllUsers();
    
    container.innerHTML = `
        <div class="admin-panel">
            <h2 class="text-center" style="color:#e60000; margin-bottom:30px;"><i class="fas fa-crown"></i> لوحة التحكم الملكية</h2>
            
            <div class="admin-card">
                <h3><i class="fas fa-lock"></i> تغيير كلمة سر الأدمن</h3>
                <input type="password" id="oldPassword" class="input-pill" placeholder="كلمة السر الحالية">
                <input type="password" id="newPassword" class="input-pill" placeholder="كلمة السر الجديدة">
                <button class="btn btn-primary" onclick="window.changeAdminPassword()">تغيير كلمة السر</button>
            </div>
            
            <div class="admin-card">
                <h3><i class="fas fa-users"></i> إدارة المستخدمين</h3>
                <input type="text" id="adminSearchUser" class="input-pill" placeholder="ابحث عن مستخدم...">
                <div id="adminUsersList"></div>
            </div>
            
            <div class="admin-card">
                <h3><i class="fas fa-book"></i> إدارة الكتب</h3>
                <div id="adminBooksList"></div>
            </div>
        </div>
    `;
    
    window.changeAdminPassword = async () => {
        const oldPass = document.getElementById('oldPassword').value;
        const newPass = document.getElementById('newPassword').value;
        if (await changeAdminPassword(oldPass, newPass)) {
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
        }
    };
    
    renderAdminUsersList(allUsers);
    renderAdminBooksList();
    
    document.getElementById('adminSearchUser').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => u.name.toLowerCase().includes(term));
        renderAdminUsersList(filtered);
    });
}

function renderAdminUsersList(users) {
    const container = document.getElementById('adminUsersList');
    if (!container) return;
    container.innerHTML = users.map(user => `
        <div class="flex-between" style="padding:15px; border-bottom:1px solid #222;">
            <div><strong>${user.name}</strong><br><small>${user.rank || 'قارئ'} | كود: ${user.inviteCode || '-'}</small></div>
            <select class="input-pill" style="width:auto; padding:8px 15px;" onchange="window.changeUserRank('${user.id}', this.value)">
                <option value="مبتدئ" ${user.rank === 'مبتدئ' ? 'selected' : ''}>مبتدئ</option>
                <option value="كاتب جامد" ${user.rank === 'كاتب جامد' ? 'selected' : ''}>كاتب جامد</option>
                <option value="أسطوري" ${user.rank === 'أسطوري' ? 'selected' : ''}>أسطوري</option>
                <option value="صاحب التطبيق" ${user.rank === 'صاحب التطبيق' ? 'selected' : ''}>صاحب التطبيق</option>
            </select>
        </div>
    `).join('');
}

function renderAdminBooksList() {
    const container = document.getElementById('adminBooksList');
    if (!container) return;
    container.innerHTML = booksCache.map(book => `
        <div class="flex-between" style="padding:15px; border-bottom:1px solid #222;">
            <div><strong>${book.title}</strong><br><small>${book.author} | ${book.views || 0} مشاهدة ${book.isArchived ? '| 📦 مؤرشف' : ''}</small></div>
            <button class="btn btn-sm btn-danger" onclick="window.deleteBook('${book.id}')">حذف</button>
        </div>
    `).join('');
}

// =====================================================
// دوال التحكم في القارئ
// =====================================================
export function increaseFont() {
    if (fontSize < 2.5) {
        fontSize += 0.1;
        const content = document.getElementById('readerContent');
        if (content) content.style.fontSize = fontSize + 'rem';
        localStorage.setItem('readerFontSize', fontSize);
    }
}

export function decreaseFont() {
    if (fontSize > 0.9) {
        fontSize -= 0.1;
        const content = document.getElementById('readerContent');
        if (content) content.style.fontSize = fontSize + 'rem';
        localStorage.setItem('readerFontSize', fontSize);
    }
}

export async function likeCurrentBook() {
    if (currentBook) {
        await toggleLike(currentBook.id);
        const book = await getBookById(currentBook.id);
        if (book) currentBook = book;
        const likeBtn = document.getElementById('readerLikeBtn');
        if (likeBtn) {
            const isLiked = currentBook.likes?.includes(getCurrentUser()?.uid);
            if (isLiked) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
        }
    }
}

export function downloadCurrentBook() {
    if (currentBook) {
        downloadBookAsText(currentBook);
    }
}

// =====================================================
// دوال رفع الصور
// =====================================================
export async function handleAvatarUpload(file) {
    if (file) {
        await updateProfilePicture(file);
        await renderProfilePage();
    }
}

export async function handleCoverUpload(file) {
    if (file) {
        await updateCoverPicture(file);
        await renderProfilePage();
    }
}

// =====================================================
// التنقل بين الصفحات
// =====================================================
export async function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.page-container').forEach(container => {
        container.classList.remove('active-page');
    });
    document.getElementById(`${page}Page`).classList.add('active-page');
    
    document.querySelectorAll('.nav-item').forEach(nav => {
        if (nav.getAttribute('data-page') === page) nav.classList.add('active');
        else nav.classList.remove('active');
    });
    
    if (page === 'home') await renderHomePage();
    else if (page === 'trending') await renderTrendingPage();
    else if (page === 'profile') await renderProfilePage();
    else if (page === 'write') renderWritePage();
    else if (page === 'reader') await renderReaderPage();
    else if (page === 'admin') await renderAdminPage();
    
    window.scrollTo(0, 0);
}

export async function openReader(bookId) {
    currentBook = await getBookById(bookId);
    if (currentBook) {
        await navigateTo('reader');
    }
}

// =====================================================
// تصدير الدوال
// =====================================================
export default {
    renderHomePage, renderTrendingPage, renderProfilePage,
    renderWritePage, renderReaderPage, renderAdminPage,
    navigateTo, openReader, increaseFont, decreaseFont, likeCurrentBook,
    downloadCurrentBook, handleAvatarUpload, handleCoverUpload
};