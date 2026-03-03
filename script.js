/**
 * Skills Practice - Project Logic
 * Updated: Teacher profile fields, Roster view, and Student feedback
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration (provided via environment)
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'skills-practice-v2';

// Local State
let currentUser = null;
let isAuthReady = false;
let activeTZ = null;
let activeTeacherId = null;
let inspectingStudentTZ = null;

// --- Helper Functions ---

const getSafeId = (str) => {
    if (!str) return "";
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
};

const showMsg = (txt) => {
    const t = document.createElement('div');
    t.className = "fixed top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-xl z-[200] font-bold shadow-2xl transition-all";
    t.innerText = txt;
    document.body.appendChild(t);
    setTimeout(() => { if(t && t.parentNode) t.parentNode.removeChild(t); }, 3000);
};

const showSection = (id) => {
    ['landingScreen', 'studentWorkspace', 'teacherDashboard'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden-section');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-section');
};

// --- Exposed Functions for HTML Click Handlers ---

window.openLoginModal = (type) => {
    window.closeLoginModals();
    if (type === 'student') {
        document.getElementById('studentLoginModal').classList.remove('hidden');
    } else {
        document.getElementById('teacherGate').classList.remove('hidden');
        document.getElementById('teacherAuthFields').classList.add('hidden');
        document.getElementById('teacherLoginModal').classList.remove('hidden');
    }
};

window.closeLoginModals = () => {
    document.getElementById('studentLoginModal').classList.add('hidden');
    document.getElementById('teacherLoginModal').classList.add('hidden');
};

window.checkTeacherGate = () => {
    const val = document.getElementById('globalTeacherPass').value;
    if (val === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        
        // Auto-check for existing profiles on blur
        document.getElementById('teacherUser').onblur = async (e) => {
            const tid = getSafeId(e.target.value);
            if (!tid) return;
            const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles', tid));
            document.getElementById('newTeacherFields').classList.toggle('hidden', snap.exists());
        };
    } else {
        showMsg("סיסמה שגויה");
    }
};

window.loginTeacher = async () => {
    if (!isAuthReady) return showMsg("מתחבר...");
    const userNm = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    if (!userNm || !pass) return showMsg("חסרים פרטים");

    const teacherId = getSafeId(userNm);
    const teacherRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles', teacherId);
    
    try {
        const snap = await getDoc(teacherRef);
        if (snap.exists()) {
            if (snap.data().password !== pass) return showMsg("סיסמה אישית שגויה");
        } else {
            const school = document.getElementById('schoolName').value.trim();
            const head = document.getElementById('deptHead').value.trim();
            if (!school || !head) return showMsg("שם בית ספר ורכז הם שדות חובה");
            await setDoc(teacherRef, { username: userNm, password: pass, schoolName: school, departmentHead: head });
        }
        
        const finalData = (await getDoc(teacherRef)).data();
        activeTeacherId = teacherId;
        document.getElementById('teacherProfileInfo').innerText = `${finalData.schoolName} | רכז: ${finalData.departmentHead}`;
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
    } catch (e) { showMsg("שגיאת הרשאות."); }
};

window.loadTeacherRoster = async () => {
    if (!activeTeacherId) return;
    const table = document.getElementById('rosterTableBody');
    table.innerHTML = '<tr><td colspan="3" class="text-center p-4">טוען נתונים...</td></tr>';
    
    try {
        const coll = collection(db, 'artifacts', appId, 'public', 'data', 'access_list');
        const snap = await getDocs(coll);
        table.innerHTML = '';
        let count = 0;
        snap.forEach((d) => {
            const data = d.data();
            if (data.teacherId === activeTeacherId) {
                count++;
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800 hover:bg-slate-800/30 transition text-right";
                tr.innerHTML = `
                    <td class="p-3 font-mono text-blue-300">${data.tz}</td>
                    <td class="p-3 text-gray-400 text-right">${data.className}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.viewStudentWork('${data.tz}')" class="text-blue-500 hover:underline text-xs font-bold">צפייה ומשוב 👁️</button>
                    </td>
                `;
                table.appendChild(tr);
            }
        });
        document.getElementById('rosterCount').innerText = count;
    } catch (e) { table.innerHTML = '<tr><td colspan="3">שגיאת טעינה</td></tr>'; }
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
        showMsg("הרשימה עודכנה בהצלחה");
        window.loadTeacherRoster();
    } catch (e) { showMsg("שגיאה בשמירה"); }
};

window.viewStudentWork = async (tz) => {
    inspectingStudentTZ = tz;
    document.getElementById('viewStudentTitle').innerText = `צפייה בתוצרי תלמיד: ${tz}`;
    document.getElementById('teacherViewModal').classList.remove('hidden');
    
    const keys = ['crew', 'location', 'questions'];
    const targets = ['viewCrew', 'viewLoc', 'viewQue'];
    
    for(let i=0; i<3; i++) {
        const el = document.getElementById(targets[i]);
        el.innerText = "טוען...";
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
        s.style.opacity = '1';
        setTimeout(() => { if(s) s.style.opacity = '0'; }, 2000);
    } catch (e) { showMsg("שגיאה בשמירת משוב"); }
};

window.loginStudent = async () => {
    if (!isAuthReady) return showMsg("מתחבר...");
    const tz = document.getElementById('studentTZ').value.trim();
    if (!tz) return showMsg("נא להזין תעודת זהות");
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            activeTZ = tz;
            document.getElementById('welcomeStudent').innerText = `שלום, ${tz} (${snap.data().className})`;
            window.loadStudentFeedback();
            window.closeLoginModals();
            showSection('studentWorkspace');
        } else { showMsg("ת\"ז לא רשומה"); }
    } catch (e) { showMsg("שגיאת אימות"); }
};

window.loadStudentFeedback = async () => {
    if (!activeTZ) return;
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', activeTZ));
    const box = document.getElementById('studentFeedbackBox');
    if (snap.exists() && snap.data().text) {
        box.classList.remove('hidden');
        document.getElementById('feedbackText').innerText = snap.data().text;
    } else { box.classList.add('hidden'); }
};

window.openProjectModal = async (key, title) => {
    if (!activeTZ) return;
    window.activeTaskKey = key;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.remove('hidden');
    const input = document.getElementById('workInput');
    input.value = "טוען...";
    
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
        s.style.opacity = '1';
        setTimeout(() => { if(s) s.style.opacity = '0'; }, 2000);
    } catch (e) { showMsg("שגיאה בשמירה"); }
};

window.closeModal = () => document.getElementById('modalOverlay').classList.add('hidden');
window.closeViewModal = () => document.getElementById('teacherViewModal').classList.add('hidden');

// --- Initialization ---

const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch(e) { console.error("Firebase auth failed", e); }
};

onAuthStateChanged(auth, (u) => {
    currentUser = u;
    isAuthReady = true;
});

// Run Init
initAuth();
