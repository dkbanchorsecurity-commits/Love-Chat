import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDCSBEZfTSb02oBe1o2ahU3FjXci-gLvc",
  authDomain: "my-private-chat-127db.firebaseapp.com",
  projectId: "my-private-chat-127db",
  storageBucket: "my-private-chat-127db.firebasestorage.app",
  messagingSenderId: "195855730116",
  appId: "1:195855730116:web:c0f28fd734ce36acb09091",
  measurementId: "G-9QBSLSWN31"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app); 
const auth = getAuth(app); 

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const userGreeting = document.getElementById('user-greeting');
const unreadBadge = document.getElementById('unread-badge');

const authForm = document.getElementById('auth-form');
const authName = document.getElementById('auth-name');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const logoutBtn = document.getElementById('logout-btn');

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
let isLoginMode = true; 

// Notification Variables
let isTabActive = true;
let unreadCount = 0;
const notificationSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');


// ==========================================
// NOTIFICATION & TAB FOCUS LOGIC
// ==========================================

window.addEventListener('focus', () => {
    isTabActive = true;
    unreadCount = 0; 
    updateBadge();
});

window.addEventListener('blur', () => {
    isTabActive = false; 
});

function updateBadge() {
    if (unreadCount > 0) {
        unreadBadge.textContent = unreadCount;
        unreadBadge.style.display = 'inline-block';
        document.title = `(${unreadCount}) LoveChat`; 
    } else {
        unreadBadge.style.display = 'none';
        document.title = 'LoveChat';
    }
}


// ==========================================
// AUTHENTICATION LOGIC
// ==========================================

authToggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authName.style.display = 'none';
        authName.removeAttribute('required');
        authSubmitBtn.textContent = 'Login';
        authToggleBtn.textContent = 'Need an account? Sign up';
    } else {
        authName.style.display = 'block';
        authName.setAttribute('required', 'true');
        authSubmitBtn.textContent = 'Sign Up';
        authToggleBtn.textContent = 'Already have an account? Login';
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    const name = authName.value.trim();

    try {
        authSubmitBtn.textContent = 'Please wait...';
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            auth.currentUser.reload();
        }
    } catch (error) {
        console.error("Auth Error:", error);
        alert(error.message); 
        authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = 'none';
        chatSection.style.display = 'flex';
        userGreeting.textContent = `Welcome, ${user.displayName || "Love"}!`;
        authForm.reset(); 
        authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
        loadMessages();
    } else {
        authSection.style.display = 'flex';
        chatSection.style.display = 'none';
        if (unsubscribeMessages) unsubscribeMessages();
    }
});


// ==========================================
// CHAT & MEDIA LOGIC
// ==========================================

function loadMessages() {
    const messagesQuery = query(collection(db, "messages"), orderBy("createdAt"));
    let isInitialLoad = true; 

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatBox.innerHTML = ''; 
        let lastDate = null; 

        // 1. Draw Messages
        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Smart Date Separator
            if (data.createdAt) {
                const messageDateObj = data.createdAt.toDate();
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                let dateString = "";
                if (messageDateObj.toDateString() === today.toDateString()) {
                    dateString = "Today";
                } else if (messageDateObj.toDateString() === yesterday.toDateString()) {
                    dateString = "Yesterday";
                } else {
                    dateString = messageDateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                }

                if (dateString !== lastDate) {
                    displayDateSeparator(dateString);
                    lastDate = dateString;
                }
            }

            displayMessage(data); 
        });
        
        // 2. Notification Logic for New Messages
        if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    if (data.senderId !== auth.currentUser.uid) {
                        notificationSound.play().catch(e => console.log("Sound blocked by browser.", e));
                        if (!isTabActive) {
                            unreadCount++;
                            updateBadge();
                        }
                    }
                }
            });
        }

        isInitialLoad = false; 
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function displayDateSeparator(dateText) {
    const separatorDiv = document.createElement('div');
    separatorDiv.classList.add('date-separator');
    const textSpan = document.createElement('span');
    textSpan.textContent = dateText;
    separatorDiv.appendChild(textSpan);
    chatBox.appendChild(separatorDiv);
}

// Reusable function to send any text/emoji instantly
async function sendTextMessage(text) {
    if (text && auth.currentUser) {
        try {
            await addDoc(collection(db, "messages"), {
                text: text,
                senderId: auth.currentUser.uid,              
                senderName: auth.currentUser.displayName,    
                createdAt: serverTimestamp()
            });
        } catch (error) { console.error("Failed to send message:", error); }
    }
}

// Send typed text
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        await sendTextMessage(text);
        messageInput.value = ''; 
    }
});

// Instant Send for Quick Emojis
emojiBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        await sendTextMessage(btn.textContent);
    });
});

// Convert Image to WebP
async function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const webpFile = new File([blob], newName, { type: 'image/webp' });
                    resolve(webpFile);
                } else { reject(new Error("Canvas to Blob failed")); }
            }, 'image/webp', 0.8); 
        };
        img.onerror = (error) => { URL.revokeObjectURL(img.src); reject(error); };
    });
}

// Upload Handler (with 20MB limit)
async function handleFileUpload(file) {
    if (!file || !auth.currentUser) return;

    const MAX_FILE_SIZE_MB = 20; 
    if (file.size > (MAX_FILE_SIZE_MB * 1024 * 1024)) {
        alert(`This file is too large (over ${MAX_FILE_SIZE_MB}MB). Please select a smaller file or trim the video.`);
        return; 
    }

    let fileToUpload = file;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (isImage && file.type !== 'image/webp') {
        try { fileToUpload = await convertToWebP(file); } 
        catch (error) { console.error("WebP conversion failed.", error); }
    }

    const storageRef = ref(storage, `uploads/${Date.now()}_${fileToUpload.name}`);
    console.log("Uploading...");

    try {
        const snapshot = await uploadBytesResumable(storageRef, fileToUpload);
        const downloadURL = await getDownloadURL(snapshot.ref);

        let messageText = `📎 ${fileToUpload.name}`;
        if (isImage) messageText = '📷 Photo';
        if (isVideo) messageText = '🎥 Video';

        await addDoc(collection(db, "messages"), {
            text: messageText,
            fileUrl: downloadURL,
            fileType: isVideo ? 'video' : (isImage ? 'image' : 'file'), 
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName,
            createdAt: serverTimestamp()
        });

    } catch (error) {
        console.error("Upload failed!", error);
        alert("Failed to upload file. Check your connection.");
    }
}

imageUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
videoUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
fileUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

// Audio Recording
micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
                audioChunks = []; 
                const storageRef = ref(storage, `uploads/voice_${Date.now()}.webm`);

                try {
                    const snapshot = await uploadBytesResumable(storageRef, audioBlob);
                    const downloadURL = await getDownloadURL(snapshot.ref);

                    await addDoc(collection(db, "messages"), {
                        text: '🎤 Voice Message',
                        fileUrl: downloadURL,
                        fileType: 'audio',
                        senderId: auth.currentUser.uid,
                        senderName: auth.currentUser.displayName,
                        createdAt: serverTimestamp()
                    });
                } catch (error) { console.error("Voice upload failed!", error); }
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.textContent = '⏹️'; 

        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Could not access the microphone.");
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.textContent = '🎤'; 
    }
});

// Render Messages
function displayMessage(data) {
    const isMe = data.senderId === auth.currentUser.uid;
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.style.display = 'flex';
    wrapperDiv.style.flexDirection = 'column';
    wrapperDiv.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
    wrapperDiv.style.maxWidth = '75%';

    if (!isMe && data.senderName) {
        const nameLabel = document.createElement('span');
        nameLabel.classList.add('sender-name');
        nameLabel.textContent = data.senderName;
        wrapperDiv.appendChild(nameLabel);
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isMe ? 'sent' : 'received');
    messageDiv.style.maxWidth = '100%'; 
    
    if (data.fileUrl) {
        if (data.fileType === 'image') {
            const img = document.createElement('img');
            img.src = data.fileUrl;
            messageDiv.appendChild(img);
        } else if (data.fileType === 'audio') {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = data.fileUrl;
            messageDiv.appendChild(audioEl);
        } else if (data.fileType === 'video') {
            const videoEl = document.createElement('video');
            videoEl.controls = true;
            videoEl.src = data.fileUrl;
            videoEl.preload = "metadata"; 
            messageDiv.appendChild(videoEl);
        } else {
            const link = document.createElement('a');
            link.href = data.fileUrl;
            link.target = "_blank"; 
            link.textContent = data.text; 
            messageDiv.appendChild(link);
        }
    } else {
        messageDiv.textContent = data.text;
    }

    // Timestamp
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    if (data.createdAt) {
        const date = data.createdAt.toDate();
        timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeSpan.textContent = "Sending...";
    }
    
    messageDiv.appendChild(timeSpan);
    wrapperDiv.appendChild(messageDiv);
    chatBox.appendChild(wrapperDiv);
}