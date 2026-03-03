/**
 * Skills Practice - Project Logic
 * גרסה מעודכנת עם חיבור לפרויקט Firebase: webpages-4aacb
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- הגדרות Firebase מותאמות אישית ---
const firebaseConfig = {
    apiKey: "AIzaSyCte4D5lS6eHAZbNvcKHY0I07yr2llh-HI",
    authDomain: "webpages-4aacb.firebaseapp.com",
    projectId: "webpages-4aacb",
    storageBucket: "webpages-4aacb.firebasestorage.app",
    messagingSenderId: "421209892208",
    appId: "1:421209892208:web:53e3ac2d7976975f579bb5"
};

// --- אתחול שירותים ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// מזהה האפליקציה עבור נתיבי Firestore (ניתן לשנות לצורך הפרדה בין פרויקטים שונים באותו DB)
const appId = 'skills-practice-v2';

// סטייט גלובלי
let currentUser = null;
let isAuthReady = false;
let activeTZ = null;
let activeTeacherId = null;
let inspectingStudentTZ = null;
let teacherMode = 'login'; 

// --- פונקציות עזר ---

const getSafeId = (str) => {
    if (!str) return "";
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
};

const showMsg = (txt) => {
    const t = document.createElement('div');
    t.className = "fixed top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-xl z-[200] font-bold shadow-2xl transition-all text-center border-2 border-white/20";
    t.innerText = txt;
    document.body.appendChild(t);
    setTimeout(() => { if(t && t.parentNode) t.parentNode.removeChild(t); }, 3000);
};

const showSection = (id) => {
    const sections = ['landingScreen', 'studentWorkspace', 'teacherDashboard'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden-section');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-section');
};

// --- פונקציות ממשק (חשופות ל-window עבור onclick ב-HTML) ---

window.togglePass = (id) => {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
};

window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const mainBtn = document.getElementById('mainTeacherBtn');

    if (mode === 'login') {
        tabLogin.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabSignup.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.add('hidden');
        mainBtn.innerText = "כניסה למערכת";
    } else {
        tabSignup.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabLogin.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.remove('hidden');
        mainBtn.innerText = "צור משתמש והתחבר";
    }
};

window.openLoginModal = (type) => {
    window.closeLoginModals();
    const modalId = type === 'student' ? 'studentLoginModal' : 'teacherLoginModal';
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.remove('hidden');
        if(type === 'teacher') {
            document.getElementById('teacherGate').classList.remove('hidden');
            document.getElementById('teacherAuthFields').classList.add('hidden');
            window.switchTeacherMode('login');
        }
    }
};

window.closeLoginModals = () => {
    ['studentLoginModal', 'teacherLoginModal'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
};

window.checkTeacherGate = () => {
    const passInput = document.getElementById('globalTeacherPass');
    if (passInput && passInput.value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
    } else {
        showMsg("סיסמה שגויה");
    }
};

// --- לוגיקת מורה ---

window.loginTeacher = async () => {
    if (!isAuthReady) return showMsg("מתחבר לשרת...");
    
    const userNm = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    if (!userNm || !pass) return showMsg("נא להזין שם משתמש וסיסמה");

    const teacherId = getSafeId(userNm);
    const teacherRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles', teacherId);
    
    try {
        const snap = await getDoc(teacherRef);
        
        if (teacherMode === 'login') {
            if (!snap.exists()) return showMsg("משתמש לא קיים. עבור ללשונית רישום.");
            if (snap.data().password !== pass) return showMsg("סיסמה אישית שגויה");
        } else {
            if (snap.exists()) return showMsg("שם משתמש תפוס. בחר שם אחר.");
            const school = document.getElementById('schoolName').value.trim();
            const head = document.getElementById('deptHead').value.trim();
            if (!school || !head) return showMsg("כל השדות הם חובה ברישום");
            
            await setDoc(teacherRef, { username: userNm, password: pass, schoolName: school, departmentHead: head });
        }
        
        const finalSnap = await getDoc(teacherRef);
        const finalData = finalSnap.data();
        activeTeacherId = teacherId;
        document.getElementById('teacherProfileInfo').innerText = `${finalData.schoolName} | רכז: ${finalData.departmentHead}`;
        
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
    } catch (e) {
        console.error("Login Error:", e);
        showMsg("שגיאת תקשורת עם השרת.");
    }
};

window.loadTeacherRoster = async () => {
    if (!activeTeacherId) return;
    const table = document.getElementById('rosterTableBody');
    table.innerHTML = '<tr><td colspan="3" class="text-center p-4 italic text-white/50 font-bold">טוען נתונים...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
        table.innerHTML = '';
        let count = 0;
        snap.forEach((d) => {
            const data = d.data();
            if (data.teacherId === activeTeacherId) {
                count++;
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800 hover:bg-white/5 transition text-right";
                tr.innerHTML = `
                    <td class="p-3 font-mono text-blue-300 text-right">${data.tz}</td>
                    <td class="p-3 text-gray-400 text-right font-bold">${data.className}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.viewStudentWork('${data.tz}')" class="text-blue-500 hover:underline text-xs font-black">צפייה ומשוב 👁️</button>
                    </td>
                `;
                table.appendChild(tr);
            }
        });
        document.getElementById('rosterCount').innerText = count;
    } catch (e) { table.innerHTML = '<tr><td colspan="3" class="text-center text-red-400">שגיאת טעינה</td></tr>'; }
};

window.saveRoster = async () => {
    if (!activeTeacherId) return;
    const className = document.getElementById('newClass').value || 'כללי';
    const rawIds = document.getElementById('studentIdsList').value;
    const ids = rawIds.split('\n').map(s => s.trim()).filter(Boolean);
    
    try {
        for (const tz of ids) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), { tz, className, teacherId: activeTeacherId });
        }
        showMsg("רשימת התלמידים עודכנה");
        window.loadTeacherRoster();
    } catch (e) { showMsg("שגיאת כתיבה לשרת."); }
};

window.viewStudentWork = async (tz) => {
    inspectingStudentTZ = tz;
    document.getElementById('viewStudentTitle').innerText = `צפייה בתוצרי תלמיד: ${tz}`;
    document.getElementById('teacherViewModal').classList.remove('hidden');
    
    const keys = ['crew', 'location', 'questions'];
    const targets = ['viewCrew', 'viewLoc', 'viewQue'];
    
    for(let i=0; i<3; i++) {
        const el = document.getElementById(targets[i]);
        el.innerText = "טוען נתונים...";
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${tz}_${keys[i]}`));
        el.innerText = snap.exists() ? snap.data().content : "(טרם הוזן)";
    }
    
    const feedSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', tz));
    document.getElementById('teacherFeedbackInput').value = feedSnap.exists() ? feedSnap.data().text : "";
};

window.saveFeedback = async () => {
    if (!inspectingStudentTZ) return;
    const text = document.getElementById('teacherFeedbackInput').value;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', inspectingStudentTZ), { text });
        const s = document.getElementById('feedbackSaveStatus');
        if(s) {
            s.style.opacity = '1';
            setTimeout(() => { if(s) s.style.opacity = '0'; }, 2000);
        }
    } catch (e) { showMsg("שגיאה בשמירת משוב"); }
};

// --- לוגיקת תלמיד ---

window.loginStudent = async () => {
    if (!isAuthReady) return showMsg("מתחבר לשרת...");
    const tz = document.getElementById('studentTZ').value.trim();
    if (!tz) return showMsg("נא להזין תעודת זהות");
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            activeTZ = tz;
            const data = snap.data();
            document.getElementById('welcomeStudent').innerText = `שלום, ${tz} (${data.className})`;
            window.loadStudentFeedback();
            window.closeLoginModals();
            showSection('studentWorkspace');
        } else { showMsg("תעודת זהות אינה רשומה"); }
    } catch (e) { showMsg("שגיאת אימות."); }
};

window.loadStudentFeedback = async () => {
    if (!activeTZ) return;
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', activeTZ));
    const box = document.getElementById('studentFeedbackBox');
    if (snap.exists() && snap.data().text) {
        box.classList.remove('hidden');
        document.getElementById('feedbackText').innerText = snap.data().text;
    } else {
        if(box) box.classList.add('hidden');
    }
};

window.openProjectModal = async (key, title) => {
    if (!activeTZ) return;
    window.activeTaskKey = key;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.remove('hidden');
    const input = document.getElementById('workInput');
    input.value = "טוען עבודה שמורה...";
    
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${key}`));
    input.value = snap.exists() ? snap.data().content : "";
};

window.saveWork = async () => {
    if (!activeTZ || !window.activeTaskKey) return;
    const content = document.getElementById('workInput').value;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${window.activeTaskKey}`), { 
            content, updatedAt: new Date().toISOString()
        });
        const s = document.getElementById('saveStatus');
        if(s) {
            s.style.opacity = '1';
            setTimeout(() => { if(s) s.style.opacity = '0'; }, 2000);
        }
    } catch (e) { showMsg("שגיאה בשמירה"); }
};

window.closeModal = () => document.getElementById('modalOverlay').classList.add('hidden');
window.closeViewModal = () => document.getElementById('teacherViewModal').classList.add('hidden');

// --- אתחול מערכת ---

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    isAuthReady = true;
});

(async () => {
    try {
        await signInAnonymously(auth);
    } catch(e) { console.error("Firebase Auth initialization failed", e); }
})();
