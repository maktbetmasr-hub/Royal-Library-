// =====================================================
// قاعدة البيانات - إدارة الكتب والتفاعلات والأرشفة
// =====================================================

import { 
    db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove, increment,
    storage, ref, uploadBytes, getDownloadURL, deleteObject, compressImage
} from './firebase-config.js';
import { getCurrentUser, getCurrentUserData, isGuest, addNotification } from './auth.js';

// =====================================================
// المتغيرات العامة
// =====================================================
let booksCache = [];
let categories = ['الكل', 'رعب', 'رومانسي', 'دراما', 'خيال علمي', 'مغامرات', 'فانتازيا', 'تاريخ', 'أدب', 'سيكولوجي', 'كوميدي'];
let viewedStories = JSON.parse(localStorage.getItem('viewedStories')) || {};
let userLikes = JSON.parse(localStorage.getItem('userLikes')) || {};
const ARCHIVE_DAYS = 60;

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
// التحقق من الأرشفة التلقائية
// =====================================================
async function checkAndArchiveBooks() {
    const now = Date.now();
    const twoMonthsAgo = now - (ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
    
    for (const book of booksCache) {
        const authorData = await getDoc(doc(db, 'users', book.authorId));
        const authorRank = authorData.exists() ? authorData.data().rank : '';
        if (authorRank === 'أسطوري' || authorRank === 'صاحب التطبيق') continue;
        
        const lastUpdate = book.updatedAt?.toDate?.()?.getTime() || book.createdAt?.toDate?.()?.getTime() || 0;
        const isArchived = book.isArchived || false;
        
        if (lastUpdate < twoMonthsAgo && !isArchived) {
            await updateDoc(doc(db, 'books', book.id), { isArchived: true, archivedAt: serverTimestamp() });
            book.isArchived = true;
        } else if (lastUpdate >= twoMonthsAgo && isArchived) {
            await updateDoc(doc(db, 'books', book.id), { isArchived: false, archivedAt: null });
            book.isArchived = false;
        }
    }
}

// =====================================================
// جلب جميع الكتب
// =====================================================
export async function loadBooks(limitCount = 50, includeArchived = false) {
    try {
        const booksRef = collection(db, 'books');
        let q;
        if (includeArchived) {
            q = query(booksRef, where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(limitCount));
        } else {
            q = query(booksRef, where('isPublished', '==', true), where('isArchived', '!=', true), orderBy('createdAt', 'desc'), limit(limitCount));
        }
        const snapshot = await getDocs(q);
        booksCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await checkAndArchiveBooks();
        return booksCache;
    } catch (error) {
        console.error('خطأ في تحميل الكتب:', error);
        return [];
    }
}

// =====================================================
// جلب كتاب واحد بالمعرف
// =====================================================
export async function getBookById(bookId) {
    try {
        const bookRef = doc(db, 'books', bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
            return { id: bookSnap.id, ...bookSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('خطأ في جلب الكتاب:', error);
        return null;
    }
}

// =====================================================
// رفع صورة غلاف الكتاب
// =====================================================
export async function uploadBookCover(file) {
    try {
        const compressed = await compressImage(file);
        const fileName = `covers/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, compressed);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error('خطأ في رفع الغلاف:', error);
        showMessage('❌ فشل رفع الصورة', 'error');
        return null;
    }
}

// =====================================================
// نشر كتاب جديد
// =====================================================
export async function publishBook(bookData, coverFile = null) {
    const currentUser = getCurrentUser();
    const currentUserData = getCurrentUserData();
    
    if (!currentUser || isGuest()) {
        showMessage('⚠️ سجل دخولك أولاً لنشر كتاب', 'error');
        return { success: false };
    }
    
    try {
        let coverURL = bookData.cover || '';
        if (coverFile) {
            coverURL = await uploadBookCover(coverFile);
        }
        
        const newBook = {
            title: bookData.title,
            author: currentUserData.name,
            authorId: currentUser.uid,
            authorPhoto: currentUserData.photoURL || '',
            category: bookData.category,
            cover: coverURL,
            content: bookData.content,
            description: bookData.description || '',
            views: 0,
            likes: [],
            comments: [],
            isPublished: true,
            isArchived: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'books'), newBook);
        
        await updateDoc(doc(db, 'users', currentUser.uid), { booksCount: increment(1) });
        
        showMessage('✅ تم نشر كتابك بنجاح!', 'success');
        return { success: true, bookId: docRef.id };
    } catch (error) {
        console.error('خطأ في نشر الكتاب:', error);
        showMessage('❌ حدث خطأ في النشر', 'error');
        return { success: false };
    }
}

// =====================================================
// تحديث كتاب (إضافة فصل جديد)
// =====================================================
export async function updateBook(bookId, newContent) {
    const currentUser = getCurrentUser();
    if (!currentUser || isGuest()) {
        showMessage('غير مصرح', 'error');
        return false;
    }
    
    try {
        const bookRef = doc(db, 'books', bookId);
        const book = await getBookById(bookId);
        if (book.authorId !== currentUser.uid) {
            showMessage('ليس لديك صلاحية', 'error');
            return false;
        }
        
        await updateDoc(bookRef, {
            content: newContent,
            updatedAt: serverTimestamp(),
            isArchived: false,
            archivedAt: null
        });
        
        showMessage('✅ تم تحديث الكتاب وإلغاء أرشفته', 'success');
        return true;
    } catch (error) {
        console.error('خطأ في التحديث:', error);
        return false;
    }
}

// =====================================================
// حذف كتاب (مع حذف صورته من التخزين)
// =====================================================
export async function deleteBook(bookId, isAdmin = false) {
    const currentUser = getCurrentUser();
    const currentUserData = getCurrentUserData();
    
    if (!currentUser || isGuest()) {
        showMessage('غير مصرح', 'error');
        return false;
    }
    
    try {
        const book = await getBookById(bookId);
        if (!book) return false;
        
        if (book.authorId !== currentUser.uid && currentUserData.role !== 'owner') {
            showMessage('ليس لديك صلاحية لحذف هذا الكتاب', 'error');
            return false;
        }
        
        if (book.cover && book.cover.includes('firebasestorage')) {
            try {
                const coverRef = ref(storage, book.cover);
                await deleteObject(coverRef);
            } catch(e) { console.log('خطأ في حذف الصورة:', e); }
        }
        
        await deleteDoc(doc(db, 'books', bookId));
        
        if (book.authorId === currentUser.uid) {
            await updateDoc(doc(db, 'users', currentUser.uid), { booksCount: increment(-1) });
        }
        
        showMessage('🗑️ تم حذف الكتاب', 'success');
        return true;
    } catch (error) {
        console.error('خطأ في حذف الكتاب:', error);
        return false;
    }
}

// =====================================================
// زيادة عدد المشاهدات (مرة واحدة لكل مستخدم)
// =====================================================
export async function incrementView(bookId) {
    const currentUserId = getCurrentUser()?.uid || 'guest';
    const viewKey = `${currentUserId}_${bookId}`;
    
    if (viewedStories[viewKey]) return false;
    
    viewedStories[viewKey] = true;
    localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
    
    try {
        const bookRef = doc(db, 'books', bookId);
        await updateDoc(bookRef, { views: increment(1) });
        
        const book = await getBookById(bookId);
        if (book && book.authorId) {
            await updateDoc(doc(db, 'users', book.authorId), { totalViews: increment(1) });
        }
        return true;
    } catch (error) {
        console.error('خطأ في زيادة المشاهدات:', error);
        return false;
    }
}

// =====================================================
// إعجاب بكتاب (مرة واحدة لكل مستخدم)
// =====================================================
export async function toggleLike(bookId) {
    const currentUser = getCurrentUser();
    const currentUserData = getCurrentUserData();
    
    if (!currentUser || isGuest()) {
        showMessage('⚠️ سجل دخولك للإعجاب', 'error');
        return false;
    }
    
    const likeKey = `${currentUser.uid}_${bookId}`;
    const isLiked = userLikes[likeKey];
    
    try {
        const bookRef = doc(db, 'books', bookId);
        
        if (isLiked) {
            delete userLikes[likeKey];
            await updateDoc(bookRef, { likes: arrayRemove(currentUser.uid) });
            showMessage(`💔 ألغيت إعجابك`, 'info');
        } else {
            userLikes[likeKey] = true;
            await updateDoc(bookRef, { likes: arrayUnion(currentUser.uid) });
            showMessage(`❤️ أعجبت بهذه القصة`, 'success');
            
            const book = await getBookById(bookId);
            if (book && book.authorId && book.authorId !== currentUser.uid) {
                await addNotification(book.authorId, `${currentUserData.name} أعجب بقصتك "${book.title}"`);
            }
        }
        
        localStorage.setItem('userLikes', JSON.stringify(userLikes));
        return true;
    } catch (error) {
        console.error('خطأ:', error);
        return false;
    }
}

// =====================================================
// متابعة مستخدم
// =====================================================
export async function toggleFollow(targetUserId) {
    const currentUser = getCurrentUser();
    const currentUserData = getCurrentUserData();
    
    if (!currentUser || isGuest()) {
        showMessage('⚠️ سجل دخولك للمتابعة', 'error');
        return false;
    }
    
    if (targetUserId === currentUser.uid) {
        showMessage('⚠️ لا يمكنك متابعة نفسك', 'error');
        return false;
    }
    
    const isFollowing = currentUserData.following?.includes(targetUserId);
    
    try {
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const targetUserRef = doc(db, 'users', targetUserId);
        
        if (isFollowing) {
            await updateDoc(currentUserRef, { following: arrayRemove(targetUserId) });
            await updateDoc(targetUserRef, { followers: arrayRemove(currentUser.uid) });
            showMessage(`❌ توقفت عن المتابعة`, 'info');
        } else {
            await updateDoc(currentUserRef, { following: arrayUnion(targetUserId) });
            await updateDoc(targetUserRef, { followers: arrayUnion(currentUser.uid) });
            showMessage(`✅ بدأت المتابعة`, 'success');
            await addNotification(targetUserId, `${currentUserData.name} بدأ بمتابعتك`);
        }
        
        const updatedSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (updatedSnap.exists()) {
            currentUserData.following = updatedSnap.data().following;
            currentUserData.followers = updatedSnap.data().followers;
        }
        return true;
    } catch (error) {
        console.error('خطأ:', error);
        showMessage('❌ حدث خطأ', 'error');
        return false;
    }
}

// =====================================================
// البحث عن الكتب
// =====================================================
export async function searchBooks(searchTerm) {
    if (!searchTerm) return booksCache.filter(b => !b.isArchived);
    const term = searchTerm.toLowerCase().trim();
    return booksCache.filter(book => 
        (!book.isArchived) && (
            book.title?.toLowerCase().includes(term) ||
            book.author?.toLowerCase().includes(term) ||
            book.category?.toLowerCase().includes(term) ||
            book.description?.toLowerCase().includes(term)
        )
    );
}

// =====================================================
// الحصول على الكتب الأكثر مشاهدة
// =====================================================
export function getTrendingBooks(limitCount = 20) {
    return [...booksCache]
        .filter(b => !b.isArchived)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, limitCount);
}

// =====================================================
// الحصول على كتب المستخدم
// =====================================================
export function getUserBooks(userId, includeArchived = true) {
    if (includeArchived) {
        return booksCache.filter(book => book.authorId === userId);
    }
    return booksCache.filter(book => book.authorId === userId && !book.isArchived);
}

// =====================================================
// جلب جميع المستخدمين
// =====================================================
export async function getAllUsers() {
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('خطأ في جلب المستخدمين:', error);
        return [];
    }
}

// =====================================================
// تحميل الكتاب كنص
// =====================================================
export function downloadBookAsText(book) {
    const content = `${book.title}\n${'='.repeat(40)}\n${book.author}\n${'='.repeat(40)}\n\n${book.content}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('📥 تم تحميل الكتاب', 'success');
}

export default {
    loadBooks, getBookById, publishBook, updateBook, deleteBook, incrementView,
    toggleLike, toggleFollow, searchBooks, getTrendingBooks, getUserBooks,
    getAllUsers, categories, booksCache, uploadBookCover, downloadBookAsText
};