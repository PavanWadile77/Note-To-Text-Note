import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: Replace with your Firebase Web App configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app, auth, storage, db;
try {
    // Only initialize if the user has provided a real config
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        storage = getStorage(app);
        db = getFirestore(app);
        console.log("Firebase initialized");
    } else {
        console.log("Using Mock Database. Update firebaseConfig to enable real cloud sync.");
    }
} catch (e) {
    console.warn("Firebase configuration error: ", e);
}

// State
let stream = null;
let currentTab = 'auth';
let isDarkMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Handle file upload
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
        uploadArea.style.background = 'rgba(2, 132, 199, 0.2)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
        uploadArea.style.background = 'var(--primary-light)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
        uploadArea.style.background = 'var(--primary-light)';
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    // Splash Screen Logic
    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash').style.display = 'none';
            // Start at Auth view initially, hide nav
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.getElementById('auth').classList.add('active');
        }, 500);
    }, 2000);

    // Load recent scans from Firebase if configured
    if (db) {
        loadRecentScans();
    }
});

async function loadRecentScans() {
    try {
        const q = query(collection(db, "scans"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        const container = document.querySelector('.recent-scans');
        if (!container) return;
        
        if (!querySnapshot.empty) {
            container.innerHTML = ''; // Clear hardcoded mock data
            
            // Stats update
            let total = 0;
            querySnapshot.forEach((doc) => {
                total++;
                const data = doc.data();
                const item = document.createElement('div');
                item.className = 'scan-item glass-card';
                item.innerHTML = `
                    <div class="scan-thumb"><i class="fa-solid fa-file-lines"></i></div>
                    <div class="scan-details">
                        <h4>${data.title || 'Untitled Note'}</h4>
                        <p>${new Date(data.timestamp?.toDate() || Date.now()).toLocaleDateString()}</p>
                    </div>
                    <div class="scan-actions">
                        <button class="icon-btn tooltip" data-tooltip="View"><i class="fa-solid fa-eye"></i></button>
                    </div>
                `;
                container.appendChild(item);
            });
            
            // Update the counter
            const totalElement = document.querySelector('.stat-card:first-child h3');
            if (totalElement) totalElement.innerText = (142 + total).toString();
        }
    } catch (e) {
        console.warn("Could not load history from Firebase:", e);
    }
}

// Theme Toggling
window.toggleTheme = function toggleTheme() {
    isDarkMode = !isDarkMode;
    const body = document.body;
    const icon = document.querySelector('.nav-actions .icon-btn i');
    
    if (isDarkMode) {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Navigation
window.switchTab = function switchTab(tabId) {
    // Update active link
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(tabId)) {
            a.classList.add('active');
        }
    });

    // Update view
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    currentTab = tabId;

    // Clean up scanner state if leaving scanner
    if (tabId !== 'scanner') {
        window.stopCamera();
    }
}

// Auth Functions
window.switchAuthForm = function(formId) {
    document.querySelectorAll('.auth-form-wrapper').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(formId).classList.add('active');
}

window.loginEmail = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if (!email || !pass) return window.showToast("Please enter email and password", "error");
    
    if (auth) {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            window.loginSuccess();
        } catch(e) { window.showToast(e.message, "error"); }
    } else {
        window.loginSuccess(); // Mock fallback
    }
}

window.signupEmail = async function() {
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    if (pass !== confirm) return window.showToast("Passwords do not match", "error");
    
    if (auth) {
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            window.showToast("Account created!", "success");
            window.loginSuccess();
        } catch(e) { window.showToast(e.message, "error"); }
    } else {
        window.showToast("Account created!", "success");
        window.loginSuccess(); // Mock fallback
    }
}

window.loginWithGoogle = async function() {
    if (auth) {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            window.loginSuccess();
        } catch(e) { window.showToast(e.message, "error"); }
    } else {
        window.loginSuccess(); // Mock fallback
    }
}

window.resetPassword = async function() {
    const email = document.getElementById('forgot-email').value;
    if (!email) return window.showToast("Please enter your email", "error");
    if (auth) {
        try {
            await sendPasswordResetEmail(auth, email);
            window.showToast("Password reset email sent", "success");
            window.switchAuthForm('form-login');
        } catch(e) { window.showToast(e.message, "error"); }
    } else {
        window.showToast("Password reset link sent to your email", "success");
        window.switchAuthForm('form-login');
    }
}

window.loginSuccess = function() {
    window.showToast("Logged in successfully!", "success");
    document.getElementById('main-nav').classList.remove('hidden');
    window.switchTab('dashboard');
}

window.logout = async function() {
    if (auth) {
        try {
            await signOut(auth);
        } catch(e) {}
    }
    window.showToast("Signed out successfully", "info");
    document.getElementById('main-nav').classList.add('hidden');
    
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('auth').classList.add('active');
    currentTab = 'auth';
    window.switchAuthForm('form-login');
}

// Scanner Functions
window.startCamera = async function startCamera() {
    const uploadArea = document.getElementById('upload-area');
    const cameraArea = document.getElementById('camera-area');
    const video = document.getElementById('camera-feed');

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        uploadArea.classList.add('hidden');
        cameraArea.classList.remove('hidden');
    } catch (err) {
        console.error("Camera error:", err);
        showToast("Cannot access camera. Please upload a file instead.", "error");
    }
}

window.stopCamera = function stopCamera() {
    const uploadArea = document.getElementById('upload-area');
    const cameraArea = document.getElementById('camera-area');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    cameraArea.classList.add('hidden');
    uploadArea.classList.remove('hidden');
}

window.captureImage = function captureImage() {
    const video = document.getElementById('camera-feed');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const imageUrl = canvas.toDataURL('image/jpeg');
    window.stopCamera();
    processImage(imageUrl);
}

function handleFile(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showToast("Please upload an image or PDF file.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        processImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function processImage(imageUrl) {
    // Set preview image
    document.getElementById('scanned-image-preview').src = imageUrl;

    // Switch Views
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('processing-area').classList.remove('hidden');

    // Simulate AI Processing Steps
    simulateProcessing();
}

function simulateProcessing() {
    const progressBar = document.getElementById('scan-progress');
    const statusText = document.getElementById('processing-status');
    const stepOcr = document.getElementById('step-ocr');
    const stepDiagram = document.getElementById('step-diagram');

    let progress = 0;
    progressBar.style.width = '0%';
    
    // Step 1: Enhancement
    setTimeout(() => {
        progress = 30;
        progressBar.style.width = progress + '%';
        statusText.innerText = "Scanning Full Page (OCR)...";
        stepOcr.classList.remove('pending');
        stepOcr.classList.add('active');
        stepOcr.querySelector('i').classList.remove('fa-circle');
        stepOcr.querySelector('i').classList.add('fa-check');
    }, 1500);

    // Step 2: Diagram Recognition
    setTimeout(() => {
        progress = 70;
        progressBar.style.width = progress + '%';
        statusText.innerText = "Recreating All Diagrams & Layout...";
        stepDiagram.classList.remove('pending');
        stepDiagram.classList.add('active');
        stepDiagram.querySelector('i').classList.remove('fa-circle');
        stepDiagram.querySelector('i').classList.add('fa-check');
    }, 3500);

    // Done
    setTimeout(() => {
        progressBar.style.width = '100%';
        statusText.innerText = "Finalizing Document...";
        setTimeout(showResult, 800);
    }, 5500);
}

function showResult() {
    document.getElementById('processing-area').classList.add('hidden');
    document.getElementById('result-area').classList.remove('hidden');
    window.showToast("Scan completed successfully!", "success");

    // Populate mock extracted content based on user language
    updateExtractedText();
    
    // Save to Firebase (fire and forget)
    saveToFirebase();
}

async function saveToFirebase() {
    if (!db || !storage) return; // Ignore if Firebase isn't set up

    try {
        const imageUrl = document.getElementById('scanned-image-preview').src;
        // Check if it's actually an uploaded base64 to save space/time vs external URLs
        if (!imageUrl.startsWith('data:image')) return;

        // 1. Upload Image to Storage
        const fileName = `scans/scan_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadString(storageRef, imageUrl, 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Save Document metadata in Firestore
        await addDoc(collection(db, "scans"), {
            title: `Note Scan - ${new Date().toLocaleTimeString()}`,
            imageUrl: downloadUrl,
            timestamp: serverTimestamp(),
            language: document.getElementById('language-select').value,
            status: 'completed'
        });
        
        console.log("Successfully saved scan to Firebase!");
        loadRecentScans(); // Refresh dashboard list
    } catch (e) {
        console.error("Firebase save error:", e);
    }
}

function updateExtractedText() {
    const editor = document.getElementById('extracted-text');
    const lang = document.getElementById('language-select').value;
    
    // Simulating advanced formatting requested by user
    let content = "";
    
    if (lang === 'en') {
        content = `
            <div style="color: var(--green); font-size: 0.8rem; margin-bottom: 1rem;"><i class="fa-solid fa-check-circle"></i> Complete Page Extracted Successfully</div>
            <h2>Physics: Thermodynamics</h2>
            <p><strong>First Law of Thermodynamics:</strong> Energy cannot be created or destroyed, only altered in form.</p>
            <p>Equation:</p>
            <div class="formula">ΔU = Q - W</div>
            <p>Where:</p>
            <ul>
                <li>ΔU = change in internal energy</li>
                <li>Q = heat added to the system</li>
                <li>W = work done by the system</li>
            </ul>
            <br>
            <h3>Efficiency Table</h3>
            <table>
                <tr><th>Engine Type</th><th>Max Efficiency</th></tr>
                <tr><td>Carnot</td><td>100% (Theoretical)</td></tr>
                <tr><td>Diesel</td><td>~45%</td></tr>
            </table>
            <br>
            <p><em>[Diagram: Carnot Cycle p-V graph recreated successfully]</em></p>
        `;
    } else if (lang === 'hi') {
        content = `
            <h2>भौतिकी: ऊष्मागतिकी</h2>
            <p><strong>ऊष्मागतिकी का प्रथम नियम:</strong> ऊर्जा न तो बनाई जा सकती है और न ही नष्ट की जा सकती है, केवल उसका रूप बदला जा सकता है।</p>
            <div class="formula">ΔU = Q - W</div>
        `;
    } else if (lang === 'mr') {
        content = `
            <h2>भौतिकशास्त्र: थर्मोडायनामिक्स</h2>
            <p><strong>थर्मोडायनामिक्सचा पहिला नियम:</strong> ऊर्जा निर्माण किंवा नष्ट केली जाऊ शकत नाही, ती केवळ एका रूपातून दुसऱ्या रूपात बदलली जाऊ शकते.</p>
            <div class="formula">ΔU = Q - W</div>
        `;
    }
    
    editor.innerHTML = content;
}

document.getElementById('language-select').addEventListener('change', () => {
    showToast("Translating content...", "info");
    setTimeout(updateExtractedText, 1000);
});

window.resetScanner = function resetScanner() {
    document.getElementById('result-area').classList.add('hidden');
    document.getElementById('upload-area').classList.remove('hidden');
    
    // Reset process state
    document.getElementById('scan-progress').style.width = '0%';
    document.getElementById('step-ocr').className = 'pending';
    document.getElementById('step-ocr').innerHTML = '<i class="fa-regular fa-circle"></i> OCR Text Extraction';
    document.getElementById('step-diagram').className = 'pending';
    document.getElementById('step-diagram').innerHTML = '<i class="fa-regular fa-circle"></i> Diagram & Math Recognition';
    
    // Clear input
    document.getElementById('file-input').value = '';
}

window.exportDocument = function exportDocument(type) {
    const editor = document.getElementById('extracted-text');
    const contentHtml = editor.innerHTML;

    if (type === 'pdf') {
        window.showToast("Generating high-quality PDF file...", "info");
        const opt = {
            margin:       0.5,
            filename:     'NexusNotes_Scan.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(editor).save().then(() => {
            window.showToast("PDF downloaded successfully!", "success");
        });
    } else if (type === 'docx') {
        window.showToast("Generating DOCX file...", "info");
        
        // Simple HTML to DOCX approach
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Nexus Notes Document</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + contentHtml + footer;
        
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'NexusNotes_Scan.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
        
        window.showToast("DOCX downloaded successfully!", "success");
    }
}

// Extra Features
window.summarizeNotes = function summarizeNotes() {
    showToast("AI is summarizing the notes...", "info");
    const editor = document.getElementById('extracted-text');
    setTimeout(() => {
        const currentHtml = editor.innerHTML;
        editor.innerHTML = `
            <div style="background: var(--primary-light); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                <strong><i class="fa-solid fa-wand-magic-sparkles"></i> AI Summary:</strong><br>
                This document covers the First Law of Thermodynamics (ΔU = Q - W), which states energy conservation. It includes definitions for internal energy, heat, and work, along with an efficiency table comparing Carnot and Diesel engines.
            </div>
        ` + currentHtml;
    }, 1500);
}

window.readAloud = function readAloud() {
    showToast("Starting Voice Reader...", "info");
    // In a real app, uses SpeechSynthesis API
}

// UI Utilities
window.showToast = function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
