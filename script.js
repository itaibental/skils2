/* Global Reset and Colors */
body {
    font-family: 'Assistant', sans-serif;
    background-color: #0f172a;
    color: #f3f4f6;
    scroll-behavior: smooth;
    overflow-x: hidden;
}

/* Glassmorphism Classes */
.glass {
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

/* Accent Colors */
.accent-orange {
    color: #f97316;
}

.bg-accent-orange {
    background-color: #f97316;
}

/* Buttons */
.btn-primary {
    background: #f97316;
    color: #000 !important;
    font-weight: 800;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border: none;
    display: inline-block;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);
    filter: brightness(1.1);
}

.btn-secondary {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    color: #3b82f6;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 800;
    transition: all 0.2s;
    cursor: pointer;
}

.btn-secondary:hover {
    background: #3b82f6;
    color: white;
}

/* Layout Utilities */
.hidden-section {
    display: none;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
}

/* Custom Scrollbar for better UI */
::-webkit-scrollbar {
    width: 8px;
}
::-webkit-scrollbar-track {
    background: #0f172a;
}
::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
    background: #334155;
}/**
 * Skills Practice - Project Logic
 * Updated: Support for Login/Signup separation and Password Toggle.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- System Variables ---
let auth, db;
let currentUser = null;
let isAuthReady = false;
let activeTZ = null;
let activeTeacherId = null;
let inspectingStudentTZ = null;
let teacherMode = 'login'; // 'login' or 'signup'

const appId = typeof __app_id !== 'undefined' ? __app_id : 'skills-practice-v2';

// --- Utility Functions ---

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

// --- Global UI Functions (window) ---

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
        tabLogin.classList.replace('text-gray-500', 'text-white');
        tabLogin.classList.replace('border-transparent', 'border-blue-500');
        tabSignup.classList.replace('text-white', 'text-gray-500');
        tabSignup.classList.replace('border-blue-500', 'border-transparent');
        newFields.classList.add('hidden');
        mainBtn.innerText = "כניסה למערכת";
    } else {
        tabSignup.classList.replace('text-gray-500', 'text-white');
        tabSignup.classList.replace('border-transparent', 'border-blue-500');
        tabLogin.classList.replace('text-white', 'text-gray-500');
        tabLogin.classList.replace('border-blue-500', 'border-transparent');
        newFields.classList.remove('hidden');
        mainBtn.innerText = "צור משתמש והתחבר";
    }
};

window.openLoginModal = (type) => {
    window.closeLoginModals();
    if (type === 'student') {
        const modal = document.getElementById('studentLoginModal');
        if(modal) modal.classList.remove('hidden');
    } else {
        const modal = document.getElementById('teacherLoginModal');
        if(modal) {
            modal.classList.remove('hidden');
            document.getElementById('teacherGate').classList.remove('hidden');
            document.getElementById('teacherAuthFields').classList.add('hidden');
            window.switchTeacherMode('login'); // Reset to login tab
        }
    }
};

window.closeLoginModals = () => {
    const sModal = document.getElementById('studentLoginModal');
    const tModal = document.getElementById('teacherLoginModal');
    if(sModal) sModal.classList.add('hidden');
    if(tModal) tModal.classList.add('hidden');
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

// --- Teacher Logic ---

window.loginTeacher = async () => {
    if (!isAuthReady || !db) return showMsg("מתחבר לשרת...");
    
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
            // Sign up mode
            if (snap.exists()) return showMsg("שם משתמש תפוס. בחר שם אחר.");
            const school = document.getElementById('schoolName').value.trim();
            const head = document.getElementById('deptHead').value.trim();
            if (!school || !head) return showMsg("כל השדות הם חובה ברישום משתמש חדש");
            
            await setDoc(teacherRef, { username: userNm, password: pass, schoolName: school, departmentHead: head });
        }
        
        const finalSnap = await getDoc(teacherRef);
        const finalData = finalSnap.data();
        activeTeacherId = teacherId;
        const profileInfo = document.getElementById('teacherProfileInfo');
        if(profileInfo) profileInfo.innerText = `${finalData.schoolName} | רכז: ${finalData.departmentHead}`;
        
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
    } catch (e) {
        console.error("Login Error:", e);
        showMsg("שגיאת תקשורת עם השרת.");
    }
};

window.loadTeacherRoster = async () => {
    if (!activeTeacherId || !db) return;
    const table = document.getElementById('rosterTableBody');
    if (!table) return;
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
        const rosterCountEl = document.getElementById('rosterCount');
        if(rosterCountEl) rosterCountEl.innerText = count;
    } catch (e) { 
        table.innerHTML = '<tr><td colspan="3" class="text-center text-red-400 font-bold">שגיאה בטעינה.</td></tr>'; 
    }
};

window.saveRoster = async () => {
    if (!activeTeacherId || !db) return;
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
    const titleEl = document.getElementById('viewStudentTitle');
    if(titleEl) titleEl.innerText = `צפייה בתוצרי תלמיד: ${tz}`;
    const modal = document.getElementById('teacherViewModal');
    if(modal) modal.classList.remove('hidden');
    
    const keys = ['crew', 'location', 'questions'];
    const targets = ['viewCrew', 'viewLoc', 'viewQue'];
    
    for(let i=0; i<3; i++) {
        const el = document.getElementById(targets[i]);
        if(el) {
            el.innerText = "טוען נתונים...";
            try {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${tz}_${keys[i]}`));
                el.innerText = snap.exists() ? snap.data().content : "(טרם הוזן)";
            } catch(e) { el.innerText = "(שגיאה)"; }
        }
    }
    
    try {
        const feedSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', tz));
        const feedInput = document.getElementById('teacherFeedbackInput');
        if(feedInput) feedInput.value = feedSnap.exists() ? feedSnap.data().text : "";
    } catch(e) { }
};

window.saveFeedback = async () => {
    if (!inspectingStudentTZ || !db) return;
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

// --- Student Logic ---

window.loginStudent = async () => {
    if (!isAuthReady || !db) return showMsg("מתחבר לשרת...");
    const tzField = document.getElementById('studentTZ');
    const tz = tzField ? tzField.value.trim() : "";
    if (!tz) return showMsg("נא להזין תעודת זהות");
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            activeTZ = tz;
            const data = snap.data();
            const welcome = document.getElementById('welcomeStudent');
            if(welcome) welcome.innerText = `שלום, ${tz} (${data.className})`;
            window.loadStudentFeedback();
            window.closeLoginModals();
            showSection('studentWorkspace');
        } else { showMsg("תעודת זהות אינה רשומה"); }
    } catch (e) { showMsg("שגיאת אימות."); }
};

window.loadStudentFeedback = async () => {
    if (!activeTZ || !db) return;
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', activeTZ));
        const box = document.getElementById('studentFeedbackBox');
        if (snap.exists() && snap.data().text) {
            if(box) box.classList.remove('hidden');
            const txtEl = document.getElementById('feedbackText');
            if(txtEl) txtEl.innerText = snap.data().text;
        } else {
            if(box) box.classList.add('hidden');
        }
    } catch(e) { }
};

window.openProjectModal = async (key, title) => {
    if (!activeTZ || !db) return;
    window.activeTaskKey = key;
    const titleEl = document.getElementById('modalTitle');
    if(titleEl) titleEl.innerText = title;
    const overlay = document.getElementById('modalOverlay');
    if(overlay) overlay.classList.remove('hidden');
    const input = document.getElementById('workInput');
    if(input) {
        input.value = "טוען עבודה שמורה...";
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${key}`));
            input.value = snap.exists() ? snap.data().content : "";
        } catch (e) { input.value = ""; }
    }
};

window.saveWork = async () => {
    if (!activeTZ || !window.activeTaskKey || !db) return;
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

window.closeModal = () => {
    const modal = document.getElementById('modalOverlay');
    if(modal) modal.classList.add('hidden');
};

window.closeViewModal = () => {
    const modal = document.getElementById('teacherViewModal');
    if(modal) modal.classList.add('hidden');
};

// --- Initialization ---

const initializeAppSequence = async () => {
    try {
        if (typeof __firebase_config === 'undefined') return;

        const firebaseConfig = JSON.parse(__firebase_config);
        const firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);

        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            isAuthReady = true;
        });

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        
        if (auth.currentUser) isAuthReady = true;

    } catch(e) { console.error("Initialization Failed:", e); }
};

initializeAppSequence();
