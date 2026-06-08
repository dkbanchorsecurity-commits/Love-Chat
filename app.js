import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
// NEW: Import Phone Auth modules
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDCSBEZfTSb02oBe1o2ahU3FjXci-gLvc",
  authDomain: "my-private-chat-127db.firebaseapp.com",
  projectId: "my-private-chat-127db",
  storageBucket: "my-private-chat-127db.firebasestorage.app",
  messagingSenderId: "195855730116",
  appId: "1:195855730116:web:c0f28fd734ce36acb09091",
  measurementId: "G-9QBSLSWN31"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app); 
const auth = getAuth(app); 
const messaging = getMessaging(app);

// DOM Elements
const authSection = document.getElementById('auth-section');
const inboxSection = document.getElementById('inbox-section');
const chatSection = document.getElementById('chat-section');

const inboxGreeting = document.getElementById('inbox-greeting');
const chatPartnerName = document.getElementById('chat-partner-name');
const unreadBadge = document.getElementById('unread-badge');

const authForm = document.getElementById('auth-form');
const authName = document.getElementById('auth-name');
const authPhone = document.getElementById('auth-phone'); // NEW
const authSubmitBtn = document.getElementById('auth-submit-btn');

const verifyForm = document.getElementById('verify-form'); // NEW
const authCode = document.getElementById('auth-code'); // NEW
const verifySubmitBtn = document.getElementById('verify-submit-btn'); // NEW
const cancelVerifyBtn = document.getElementById('cancel-verify-btn'); // NEW
const logoutBtn = document.getElementById('logout-btn');

const addContactForm = document.getElementById('add-contact-form');
const newContactPhone = document.getElementById('new-contact-phone'); // NEW
const contactList = document.getElementById('contact-list');
const backToInboxBtn = document.getElementById('back-to-inbox-btn');

const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatBox = document.getElementById('chat-box');
const imageUpload = document.getElementById('image-upload'); 
const videoUpload = document.getElementById('video-upload'); 
const fileUpload = document.getElementById('file-upload'); 
const micBtn = document.getElementById('mic-btn');
const emojiBtns = document.querySelectorAll('.emoji-btn');

// State Variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let unsubscribeMessages = null; 
let unsubscribeContacts = null;
let currentActiveRoomId = null; 
let currentPartnerDetails = null;

// Phone Auth Variable
let confirmationResult = null;

// Notification Variables
let isTabActive = true;
let unreadCount = 0;
const notificationSound = new Audio('notification.wav');
notificationSound.volume = 1.0;

// ==========================================
// NOTIFICATION LOGIC
// ==========================================
window.addEventListener('focus', () => { isTabActive = true; unreadCount = 0; updateBadge(); });
window.addEventListener('blur', () => { isTabActive = false; });

function updateBadge() {
    if (unreadCount > 0) {
        unreadBadge.textContent = unreadCount; unreadBadge.style.display = 'inline-block'; document.title = `(${unreadCount}) LoveChat`; 
        if ('setAppBadge' in navigator) navigator.setAppBadge(unreadCount).catch(e => console.error(e));
    } else {
        unreadBadge.style.display = 'none'; document.title = 'LoveChat';
        if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(e => console.error(e));
    }
}

async function requestPushPermissions() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getToken(messaging, { vapidKey: 'BMij6-HsOZkHRSx1b5phkZN3jXh2TT8nyjWLxia-1uuz4nTfPtJI3AF63ihnxkq16sbavg95JslhTqMcVq-Bppw' });
            if (currentToken) {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    token: currentToken,
                    name: auth.currentUser.displayName,
                    phoneNumber: auth.currentUser.phoneNumber 
                }, { merge: true });
            }
        }
    } catch (error) { console.error("Token error", error); }
}

// ==========================================
// PHONE AUTHENTICATION LOGIC
// ==========================================

// Initialize reCAPTCHA
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'normal',
            'callback': (response) => {
                // reCAPTCHA solved, allow sending SMS
            }
        });
    }
}

// Step 1: Send the SMS
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneNumber = authPhone.value.trim();
    
    // Format requirement: Phone numbers MUST include country code (e.g., +1, +44)
    if (!phoneNumber.startsWith('+')) {
        alert("Please include your country code (e.g., +1 for US/Canada).");
        return;
    }

    setupRecaptcha();
    authSubmitBtn.textContent = 'Sending...';

    try {
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        // Switch to Verification UI
        authForm.style.display = 'none';
        verifyForm.style.display = 'block';
        authSubmitBtn.textContent = 'Send SMS Code';
    } catch (error) {
        console.error("SMS Error:", error);
        alert("Failed to send SMS. Check the number format or try again.");
        authSubmitBtn.textContent = 'Send SMS Code';
        if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
    }
});

// Step 2: Verify the Code
verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = authCode.value.trim();
    const name = authName.value.trim();
    verifySubmitBtn.textContent = 'Verifying...';

    try {
        const result = await confirmationResult.confirm(code);
        const user = result.user;

        // Save name to Profile and Firestore
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            phoneNumber: user.phoneNumber, // Save phone number for routing
            token: "" 
        }, { merge: true }); // Merge ensures we don't overwrite existing contact lists
        
        verifyForm.reset();
        verifySubmitBtn.textContent = 'Verify & Login';
    } catch (error) {
        console.error(error);
        alert("Invalid SMS Code. Please try again.");
        verifySubmitBtn.textContent = 'Verify & Login';
    }
});

cancelVerifyBtn.addEventListener('click', () => {
    verifyForm.style.display = 'none';
    authForm.style.display = 'block';
    authCode.value = '';
    if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.style.display = 'none';
        inboxSection.style.display = 'flex';
        chatSection.style.display = 'none';
        inboxGreeting.textContent = `Welcome, ${user.displayName || "Love"}!`;
        
        loadInbox();
        requestPushPermissions(); 
    } else {
        authSection.style.display = 'flex';
        inboxSection.style.display = 'none';
        chatSection.style.display = 'none';
        verifyForm.style.display = 'none';
        authForm.style.display = 'block';
        currentActiveRoomId = null;
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeContacts) unsubscribeContacts();
    }
});


// ==========================================
// INBOX & ROUTING LOGIC
// ==========================================

function getPrivateRoomId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

// Add contact via PHONE NUMBER
addContactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const searchPhone = newContactPhone.value.trim();
    if (!searchPhone.startsWith('+')) { alert("Include country code (e.g., +1)"); return; }
    if (searchPhone === auth.currentUser.phoneNumber) { alert("You cannot add yourself."); return; }

    try {
        // Query database by phone number
        const q = query(collection(db, "users"), where("phoneNumber", "==", searchPhone));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            alert("No user found with that phone number. Make sure they have registered!"); return;
        }

        querySnapshot.forEach(async (userDoc) => {
            const partnerData = userDoc.data();
            const partnerId = userDoc.id;

            await setDoc(doc(db, "users", auth.currentUser.uid, "contacts", partnerId), {
                uid: partnerId, name: partnerData.name, phoneNumber: partnerData.phoneNumber
            });

            await setDoc(doc(db, "users", partnerId, "contacts", auth.currentUser.uid), {
                uid: auth.currentUser.uid, name: auth.currentUser.displayName, phoneNumber: auth.currentUser.phoneNumber
            });

            newContactPhone.value = '';
            openChatWindow(partnerId, partnerData.name);
        });
    } catch (error) { console.error("Search error", error); }
});

function loadInbox() {
    const contactsQuery = query(collection(db, "users", auth.currentUser.uid, "contacts"));
    
    unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
        contactList.innerHTML = '';
        if (snapshot.empty) contactList.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">No active chats. Add a phone number above!</p>';
        
        snapshot.forEach((doc) => {
            const contact = doc.data();
            const card = document.createElement('div');
            card.classList.add('contact-card');
            
            card.innerHTML = `
                <span class="contact-name">${contact.name}</span>
                <span class="contact-email">${contact.phoneNumber}</span>
            `;
            
            card.addEventListener('click', () => openChatWindow(contact.uid, contact.name));
            contactList.appendChild(card);
        });
    });
}

function openChatWindow(partnerUid, partnerName) {
    currentActiveRoomId = getPrivateRoomId(auth.currentUser.uid, partnerUid);
    currentPartnerDetails = { uid: partnerUid, name: partnerName };
    chatPartnerName.textContent = partnerName;
    inboxSection.style.display = 'none'; chatSection.style.display = 'flex';
    loadMessages(currentActiveRoomId);
}

backToInboxBtn.addEventListener('click', () => {
    chatSection.style.display = 'none'; inboxSection.style.display = 'flex';
    currentActiveRoomId = null; currentPartnerDetails = null;
    if (unsubscribeMessages) unsubscribeMessages();
});

// ==========================================
// CHAT & MEDIA LOGIC
// ==========================================

function loadMessages(roomId) {
    const messagesQuery = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt"));
    let isInitialLoad = true; 

    if (unsubscribeMessages) unsubscribeMessages(); 

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatBox.innerHTML = ''; let lastDate = null; 

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt) {
                const msgDate = data.createdAt.toDate(); const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1);
                let dStr = "";
                if (msgDate.toDateString() === today.toDateString()) dStr = "Today"; 
                else if (msgDate.toDateString() === yest.toDateString()) dStr = "Yesterday"; 
                else dStr = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                if (dStr !== lastDate) { displayDateSeparator(dStr); lastDate = dStr; }
            }
            displayMessage(data); 
        });
        
        if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" && change.doc.data().senderId !== auth.currentUser.uid) {
                    notificationSound.play().catch(e => console.log(e));
                    if (!isTabActive) { unreadCount++; updateBadge(); }
                }
            });
        }
        isInitialLoad = false; chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function displayDateSeparator(dateText) {
    const div = document.createElement('div'); div.classList.add('date-separator');
    const span = document.createElement('span'); span.textContent = dateText;
    div.appendChild(span); chatBox.appendChild(div);
}

async function sendTextMessage(text) {
    if (text && auth.currentUser && currentActiveRoomId) {
        try {
            await addDoc(collection(db, "chats", currentActiveRoomId, "messages"), {
                text: text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp()
            });
        } catch (error) { console.error("Send failed:", error); }
    }
}

messageInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = this.value.trim(); if (t) { sendTextMessage(t); this.value = ''; this.style.height = 'auto'; } }
});
chatForm.addEventListener('submit', async (e) => { e.preventDefault(); const t = messageInput.value.trim(); if (t) { await sendTextMessage(t); messageInput.value = ''; messageInput.style.height = 'auto'; } });
emojiBtns.forEach(btn => btn.addEventListener('click', async () => await sendTextMessage(btn.textContent)));

async function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src); const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => { if (b) resolve(new File([b], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })); else reject(new Error("WebP fail")); }, 'image/webp', 0.8); 
        }; img.onerror = (e) => { URL.revokeObjectURL(img.src); reject(e); };
    });
}

async function handleFileUpload(file) {
    if (!file || !auth.currentUser || !currentActiveRoomId) return;
    if (file.size > (20 * 1024 * 1024)) { alert(`File too large (over 20MB).`); return; }

    let fileToUpload = file;
    if (file.type.startsWith('image/') && file.type !== 'image/webp') { try { fileToUpload = await convertToWebP(file); } catch (e) { console.error(e); } }

    const storageRef = ref(storage, `uploads/${currentActiveRoomId}/${Date.now()}_${fileToUpload.name}`);
    try {
        const snapshot = await uploadBytesResumable(storageRef, fileToUpload);
        const downloadURL = await getDownloadURL(snapshot.ref);
        let mText = `📎 ${fileToUpload.name}`;
        if (file.type.startsWith('image/')) mText = '📷 Photo'; if (file.type.startsWith('video/')) mText = '🎥 Video';

        await addDoc(collection(db, "chats", currentActiveRoomId, "messages"), {
            text: mText, fileUrl: downloadURL, fileType: file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : 'file'), 
            senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp()
        });
    } catch (error) { alert("Upload failed."); }
}

imageUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
videoUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
fileUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType }); audioChunks = []; 
                const storageRef = ref(storage, `uploads/${currentActiveRoomId}/voice_${Date.now()}.webm`);
                try {
                    const snapshot = await uploadBytesResumable(storageRef, audioBlob);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    await addDoc(collection(db, "chats", currentActiveRoomId, "messages"), {
                        text: '🎤 Voice Message', fileUrl: downloadURL, fileType: 'audio',
                        senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp()
                    });
                } catch (e) { console.error(e); }
            };
            mediaRecorder.start(); isRecording = true; micBtn.classList.add('recording'); micBtn.textContent = '⏹️'; 
        } catch (err) { alert("Microphone access denied."); }
    } else {
        mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); 
        isRecording = false; micBtn.classList.remove('recording'); micBtn.textContent = '🎤'; 
    }
});

function displayMessage(data) {
    const isMe = data.senderId === auth.currentUser.uid;
    const wrapperDiv = document.createElement('div');
    wrapperDiv.style.display = 'flex'; wrapperDiv.style.flexDirection = 'column';
    wrapperDiv.style.alignSelf = isMe ? 'flex-end' : 'flex-start'; wrapperDiv.style.maxWidth = '75%';

    if (!isMe && data.senderName) {
        const nameLabel = document.createElement('span'); nameLabel.classList.add('sender-name'); 
        nameLabel.textContent = data.senderName; wrapperDiv.appendChild(nameLabel);
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isMe ? 'sent' : 'received');
    
    if (data.fileUrl) {
        if (data.fileType === 'image') {
            const img = document.createElement('img'); img.src = data.fileUrl; messageDiv.appendChild(img);
        } else if (data.fileType === 'audio') {
            const audioEl = document.createElement('audio'); audioEl.controls = true; audioEl.src = data.fileUrl; messageDiv.appendChild(audioEl);
        } else if (data.fileType === 'video') {
            const videoEl = document.createElement('video'); videoEl.controls = true; videoEl.src = data.fileUrl; videoEl.preload = "metadata"; messageDiv.appendChild(videoEl);
        } else {
            const link = document.createElement('a'); link.href = data.fileUrl; link.target = "_blank"; link.textContent = data.text; messageDiv.appendChild(link);
        }
    } else { messageDiv.textContent = data.text; }

    const timeSpan = document.createElement('span'); timeSpan.classList.add('timestamp');
    if (data.createdAt) timeSpan.textContent = data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    else timeSpan.textContent = "Sending..."; 
    
    messageDiv.appendChild(timeSpan); wrapperDiv.appendChild(messageDiv); chatBox.appendChild(wrapperDiv);
}