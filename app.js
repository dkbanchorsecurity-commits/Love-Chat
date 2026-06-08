import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, getDocs, where, deleteDoc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDCSBEZfTSb02oBe1o2ahU3FjXci-gLvc",
  authDomain: "my-private-chat-127db.firebaseapp.com",
  projectId: "my-private-chat-127db",
  storageBucket: "my-private-chat-127db.firebasestorage.app",
  messagingSenderId: "195855730116",
  appId: "1:195855730116:web:c0f28fd734ce36acb09091"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(e => console.log("Offline mode error:", e.code));

const storage = getStorage(app); 
const auth = getAuth(app); 
const messaging = getMessaging(app);

// DOM Elements
const authSection = document.getElementById('auth-section'); const inboxSection = document.getElementById('inbox-section'); const chatSection = document.getElementById('chat-section');
const inboxHeader = document.getElementById('inbox-header'); const chatHeader = document.getElementById('chat-header');
const inboxGreeting = document.getElementById('inbox-greeting'); const chatPartnerName = document.getElementById('chat-partner-name'); const unreadBadge = document.getElementById('unread-badge');
const authForm = document.getElementById('auth-form'); const authName = document.getElementById('auth-name'); const authPhone = document.getElementById('auth-phone'); const authSubmitBtn = document.getElementById('auth-submit-btn');
const verifyForm = document.getElementById('verify-form'); const authCode = document.getElementById('auth-code'); const verifySubmitBtn = document.getElementById('verify-submit-btn'); const cancelVerifyBtn = document.getElementById('cancel-verify-btn'); const logoutBtn = document.getElementById('logout-btn');

const addContactForm = document.getElementById('add-contact-form'); const newContactPhone = document.getElementById('new-contact-phone'); const contactList = document.getElementById('contact-list'); const backToInboxBtn = document.getElementById('back-to-inbox-btn'); const deviceContactsBtn = document.getElementById('device-contacts-btn');
const chatForm = document.getElementById('chat-form'); const messageInput = document.getElementById('message-input'); const chatBox = document.getElementById('chat-box');
const imageUpload = document.getElementById('image-upload'); const videoUpload = document.getElementById('video-upload'); const fileUpload = document.getElementById('file-upload'); const micBtn = document.getElementById('mic-btn'); const emojiBtns = document.querySelectorAll('.emoji-btn');
const typingIndicator = document.getElementById('typing-indicator'); const typingTextName = document.getElementById('typing-text-name');
const myAvatar = document.getElementById('my-avatar'); const profilePicUpload = document.getElementById('profile-pic-upload'); const chatPartnerAvatar = document.getElementById('chat-partner-avatar'); 

const selectionHeader = document.getElementById('selection-header'); const cancelSelectionBtn = document.getElementById('cancel-selection-btn'); const selectionCount = document.getElementById('selection-count'); const multiForwardBtn = document.getElementById('multi-forward-btn'); const multiDeleteBtn = document.getElementById('multi-delete-btn');
const actionSheetModal = document.getElementById('action-sheet-modal'); const btnClearChat = document.getElementById('btn-clear-chat'); const btnCancelAction = document.getElementById('btn-cancel-action');
const forwardModal = document.getElementById('forward-modal'); const forwardContactList = document.getElementById('forward-contact-list'); const btnCancelForward = document.getElementById('btn-cancel-forward');
const locationBtn = document.getElementById('location-btn'); const viewMapBtn = document.getElementById('view-map-btn'); const mapModal = document.getElementById('map-modal'); const closeMapBtn = document.getElementById('close-map-btn');
const profileViewerModal = document.getElementById('profile-viewer-modal'); const viewerImage = document.getElementById('viewer-image'); const viewerName = document.getElementById('viewer-name'); const closeViewerBtn = document.getElementById('close-viewer-btn'); const zoomInBtn = document.getElementById('zoom-in-btn'); const zoomOutBtn = document.getElementById('zoom-out-btn');

const openCreateGroupBtn = document.getElementById('open-create-group-btn'); const createGroupModal = document.getElementById('create-group-modal'); const groupNameInput = document.getElementById('group-name-input'); const groupContactList = document.getElementById('group-contact-list'); const btnCancelGroup = document.getElementById('btn-cancel-group'); const btnConfirmGroup = document.getElementById('btn-confirm-group');

// State Variables
let mediaRecorder; let audioChunks = []; let isRecording = false;
let unsubscribeMessages = null; let unsubscribeContacts = null; let unsubscribeTyping = null; let typingTimeout = null;     
let currentActiveRoomId = null; let currentRoomType = "chats"; let currentPartnerDetails = null; let confirmationResult = null;
let isSelectionMode = false; let selectedMessages = new Set();
let watchId = null; let mapInstance = null; let partnerMarker = null; let unsubscribePartnerLocation = null;
let isTabActive = true; let unreadCount = 0; const notificationSound = new Audio('notification.wav'); notificationSound.volume = 1.0;

window.addEventListener('offline', () => { inboxHeader.style.backgroundColor = '#888888'; chatHeader.style.backgroundColor = '#888888'; });
window.addEventListener('online', () => { inboxHeader.style.backgroundColor = '#ff6b81'; chatHeader.style.backgroundColor = '#ff6b81'; });
window.addEventListener('focus', () => { isTabActive = true; unreadCount = 0; updateBadge(); });
window.addEventListener('blur', () => { isTabActive = false; });
window.addEventListener('popstate', () => { if (currentActiveRoomId) closeChatWindow(); });

function updateBadge() {
    if (unreadCount > 0) { unreadBadge.textContent = unreadCount; unreadBadge.style.display = 'inline-block'; document.title = `(${unreadCount}) LoveChat`; if ('setAppBadge' in navigator) navigator.setAppBadge(unreadCount).catch(e=>e); } 
    else { unreadBadge.style.display = 'none'; document.title = 'LoveChat'; if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(e=>e); }
}

async function requestPushPermissions() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getToken(messaging, { vapidKey: 'BMij6-HsOZkHRSx1b5phkZN3jXh2TT8nyjWLxia-1uuz4nTfPtJI3AF63ihnxkq16sbavg95JslhTqMcVq-Bppw' });
            if (currentToken) await setDoc(doc(db, "users", auth.currentUser.uid), { token: currentToken, name: auth.currentUser.displayName, phoneNumber: auth.currentUser.phoneNumber }, { merge: true });
        }
    } catch (e) {}
}

function setupRecaptcha() { if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'normal', 'callback': () => {} }); }

authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const phoneNumber = authPhone.value.trim();
    if (!phoneNumber.startsWith('+')) { alert("Include country code (e.g., +1)."); return; }
    setupRecaptcha(); authSubmitBtn.textContent = 'Sending...';
    try {
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        authForm.style.display = 'none'; verifyForm.style.display = 'block'; authSubmitBtn.textContent = 'Send SMS Code';
    } catch (error) { alert("Failed to send SMS."); authSubmitBtn.textContent = 'Send SMS Code'; if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(w => grecaptcha.reset(w)); }
});

verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const code = authCode.value.trim(); const name = authName.value.trim(); verifySubmitBtn.textContent = 'Verifying...';
    try {
        const result = await confirmationResult.confirm(code); const user = result.user;
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, "users", user.uid), { name: name, phoneNumber: user.phoneNumber, token: "" }, { merge: true }); 
        verifyForm.reset(); verifySubmitBtn.textContent = 'Verify & Login';
    } catch (error) { alert("Invalid SMS Code."); verifySubmitBtn.textContent = 'Verify & Login'; }
});

cancelVerifyBtn.addEventListener('click', () => { verifyForm.style.display = 'none'; authForm.style.display = 'block'; authCode.value = ''; if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(w => grecaptcha.reset(w)); });
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        history.replaceState({ view: 'inbox' }, '', '#inbox');
        if (user.photoURL) { myAvatar.textContent = ''; myAvatar.style.backgroundImage = `url(${user.photoURL})`; } else { myAvatar.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'L'; myAvatar.style.backgroundImage = ''; }
        authSection.style.display = 'none'; inboxSection.style.display = 'flex'; chatSection.style.display = 'none';
        inboxGreeting.textContent = `Welcome, ${user.displayName || "Love"}!`;
        loadInbox(); requestPushPermissions(); 
    } else {
        history.replaceState({ view: 'auth' }, '', '#login');
        authSection.style.display = 'flex'; inboxSection.style.display = 'none'; chatSection.style.display = 'none';
        verifyForm.style.display = 'none'; authForm.style.display = 'block'; currentActiveRoomId = null;
        if (unsubscribeMessages) unsubscribeMessages(); if (unsubscribeContacts) unsubscribeContacts(); if (unsubscribeTyping) unsubscribeTyping(); if (unsubscribePartnerLocation) unsubscribePartnerLocation();
    }
});

profilePicUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file || !auth.currentUser) return;
    myAvatar.textContent = '⏳'; myAvatar.style.backgroundImage = 'none';
    try {
        let fileToUpload = file; if (file.type.startsWith('image/') && file.type !== 'image/webp') { try { fileToUpload = await convertToWebP(file); } catch (e) { } }
        const storageRef = ref(storage, `profiles/${auth.currentUser.uid}_${Date.now()}.webp`);
        const snapshot = await uploadBytesResumable(storageRef, fileToUpload); const downloadURL = await getDownloadURL(snapshot.ref);
        await updateProfile(auth.currentUser, { photoURL: downloadURL }); await setDoc(doc(db, "users", auth.currentUser.uid), { photoUrl: downloadURL }, { merge: true });
        myAvatar.textContent = ''; myAvatar.style.backgroundImage = `url(${downloadURL})`;
    } catch (error) { alert("Failed to update profile picture."); myAvatar.textContent = auth.currentUser.displayName.charAt(0).toUpperCase(); }
});

// ==========================================
// INBOX & ROUTING
// ==========================================
function getPrivateRoomId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

async function processAddContact(searchPhone) {
    if (!searchPhone.startsWith('+')) { alert("Include country code (e.g., +1)"); return; }
    if (searchPhone === auth.currentUser.phoneNumber) { alert("You cannot add yourself."); return; }
    try {
        const q = query(collection(db, "users"), where("phoneNumber", "==", searchPhone));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { 
            if (confirm("This contact has not registered! Send an SMS invite?")) window.location.href = `sms:${searchPhone}?body=Join me on LoveChat!`;
            return; 
        }
        querySnapshot.forEach(async (userDoc) => {
            const partnerData = userDoc.data(); const partnerId = userDoc.id;
            await setDoc(doc(db, "users", auth.currentUser.uid, "contacts", partnerId), { uid: partnerId, name: partnerData.name, phoneNumber: partnerData.phoneNumber });
            await setDoc(doc(db, "users", partnerId, "contacts", auth.currentUser.uid), { uid: auth.currentUser.uid, name: auth.currentUser.displayName, phoneNumber: auth.currentUser.phoneNumber });
            newContactPhone.value = ''; openChatWindow(partnerId, partnerData.name, partnerData.photoUrl, false);
        });
    } catch (error) { console.error(error); }
}

addContactForm.addEventListener('submit', async (e) => { e.preventDefault(); await processAddContact(newContactPhone.value.trim()); });
deviceContactsBtn.addEventListener('click', async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) { alert("Your browser blocks native contacts. Type it manually."); return; }
    try {
        const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (contacts.length > 0 && contacts[0].tel.length > 0) {
            let formattedNumber = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '');
            if (!formattedNumber.startsWith('+')) formattedNumber = prompt(`LoveChat requires a country code.\n\nAdd it to ${contacts[0].name[0]}'s number:`, `+${formattedNumber}`);
            if (formattedNumber) { newContactPhone.value = formattedNumber; await processAddContact(formattedNumber); }
        }
    } catch (err) {}
});

// Group UI
openCreateGroupBtn.addEventListener('click', async () => {
    groupNameInput.value = ''; groupContactList.innerHTML = '<p style="text-align:center;">Loading...</p>'; createGroupModal.style.display = 'flex';
    const snapshot = await getDocs(query(collection(db, "users", auth.currentUser.uid, "contacts")));
    groupContactList.innerHTML = ''; let hasContacts = false;
    snapshot.forEach((docSnap) => {
        const contact = docSnap.data();
        if (!contact.isGroup) {
            hasContacts = true; const div = document.createElement('div'); div.classList.add('message-wrapper'); div.style.padding = "10px";
            div.innerHTML = `<input type="checkbox" class="group-member-checkbox" value="${contact.uid}" style="width: 20px; height: 20px; margin-right: 15px;"><span style="font-size: 16px; font-weight: bold;">${contact.name}</span>`;
            groupContactList.appendChild(div);
        }
    });
    if (!hasContacts) groupContactList.innerHTML = '<p style="text-align:center; color:#888;">No contacts available.</p>';
});

btnCancelGroup.addEventListener('click', () => createGroupModal.style.display = 'none');
btnConfirmGroup.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim(); if (!groupName) { alert("Enter a group name."); return; }
    const checkboxes = document.querySelectorAll('.group-member-checkbox:checked'); if (checkboxes.length === 0) { alert("Select at least one contact."); return; }
    
    const selectedUids = Array.from(checkboxes).map(cb => cb.value); selectedUids.push(auth.currentUser.uid);
    btnConfirmGroup.textContent = "Creating...";
    try {
        const newGroupRef = doc(collection(db, "groups")); const groupId = newGroupRef.id;
        await setDoc(newGroupRef, { name: groupName, members: selectedUids, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
        const addPromises = selectedUids.map(uid => setDoc(doc(db, "users", uid, "contacts", groupId), { uid: groupId, name: groupName, isGroup: true }));
        await Promise.all(addPromises);
        createGroupModal.style.display = 'none'; btnConfirmGroup.textContent = "Create";
        openChatWindow(groupId, groupName, null, true); 
    } catch (error) { alert("Failed to create group."); btnConfirmGroup.textContent = "Create"; }
});

function loadInbox() {
    const contactsQuery = query(collection(db, "users", auth.currentUser.uid, "contacts"));
    unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
        contactList.innerHTML = '';
        if (snapshot.empty) contactList.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">No active chats. Add a phone number above!</p>';
        snapshot.forEach(async (docSnap) => {
            const contact = docSnap.data(); const isGroup = contact.isGroup || false; let partnerPhoto = null;
            if (!isGroup) { try { const pDoc = await getDoc(doc(db, "users", contact.uid)); if(pDoc.exists()) partnerPhoto = pDoc.data().photoUrl; } catch(e){} }
            const avatarContent = isGroup ? '👥' : (partnerPhoto ? '' : contact.name.charAt(0).toUpperCase());
            const avatarStyle = partnerPhoto ? `background-image: url(${partnerPhoto});` : '';
            const card = document.createElement('div'); card.classList.add('contact-card');
            card.innerHTML = `
                <div class="contact-avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="contact-info"><span class="contact-name">${contact.name}</span><span class="contact-email">${isGroup ? 'Group Chat' : contact.phoneNumber}</span></div>
                <div class="contact-action">💬</div>
            `;
            card.addEventListener('click', () => openChatWindow(contact.uid, contact.name, partnerPhoto, isGroup));
            contactList.appendChild(card);
        });
    });
}

function openChatWindow(partnerUid, partnerName, partnerPhoto = null, isGroup = false) {
    currentRoomType = isGroup ? "groups" : "chats";
    currentActiveRoomId = isGroup ? partnerUid : getPrivateRoomId(auth.currentUser.uid, partnerUid);
    currentPartnerDetails = { uid: partnerUid, name: partnerName, photoUrl: partnerPhoto, isGroup: isGroup };
    
    chatPartnerName.textContent = partnerName; 
    if (isGroup) {
        chatPartnerAvatar.textContent = '👥'; chatPartnerAvatar.style.backgroundImage = ''; locationBtn.style.display = 'none';
    } else {
        locationBtn.style.display = 'flex';
        if (partnerPhoto) { chatPartnerAvatar.textContent = ''; chatPartnerAvatar.style.backgroundImage = `url(${partnerPhoto})`; } 
        else { chatPartnerAvatar.textContent = partnerName.charAt(0).toUpperCase(); chatPartnerAvatar.style.backgroundImage = ''; }
        listenToPartnerLocation(partnerUid);
    }
    
    typingTextName.textContent = isGroup ? `Someone is typing` : `${partnerName} is typing`; 
    history.pushState({ view: 'chat' }, '', '#chat');
    inboxSection.style.display = 'none'; chatSection.style.display = 'flex';
    loadMessages(currentActiveRoomId);
}

function closeChatWindow() {
    toggleSelectionMode(false);
    chatSection.style.display = 'none'; inboxSection.style.display = 'flex';
    if (currentActiveRoomId && auth.currentUser) setDoc(doc(db, currentRoomType, currentActiveRoomId), { typing: { [auth.currentUser.uid]: false } }, { merge: true });
    currentActiveRoomId = null; currentPartnerDetails = null;
    if (unsubscribeMessages) unsubscribeMessages(); if (unsubscribeTyping) unsubscribeTyping(); if (unsubscribePartnerLocation) unsubscribePartnerLocation();
    viewMapBtn.style.display = 'none'; mapModal.style.display = 'none';
}
backToInboxBtn.addEventListener('click', () => history.back());

// ==========================================
// SELECTION MODE & ACTION LOGIC
// ==========================================
function toggleSelectionMode(state) {
    isSelectionMode = state;
    if (state) { chatHeader.style.display = 'none'; selectionHeader.style.display = 'flex'; chatBox.classList.add('selection-mode'); updateSelectionHeader(); } 
    else { chatHeader.style.display = 'flex'; selectionHeader.style.display = 'none'; chatBox.classList.remove('selection-mode'); selectedMessages.clear(); document.querySelectorAll('.message-wrapper').forEach(el => el.classList.remove('selected')); }
}

function updateSelectionHeader() {
    selectionCount.textContent = `${selectedMessages.size} Selected`;
    const allMine = Array.from(selectedMessages).every(msg => msg.data.senderId === auth.currentUser.uid);
    multiDeleteBtn.style.opacity = allMine ? '1' : '0.3'; multiDeleteBtn.style.pointerEvents = allMine ? 'auto' : 'none';
}

cancelSelectionBtn.addEventListener('click', () => toggleSelectionMode(false));
multiDeleteBtn.addEventListener('click', async () => {
    if (selectedMessages.size === 0 || !currentActiveRoomId) return;
    if (confirm(`Delete ${selectedMessages.size} message(s) for everyone?`)) {
        try {
            const deletePromises = Array.from(selectedMessages).map(msg => deleteDoc(doc(db, currentRoomType, currentActiveRoomId, "messages", msg.id)));
            await Promise.all(deletePromises); toggleSelectionMode(false);
        } catch (e) { alert("Failed to delete."); }
    }
});

document.getElementById('chat-partner-name').parentElement.addEventListener('click', () => { if(!isSelectionMode) actionSheetModal.style.display = 'flex'; });
btnCancelAction.addEventListener('click', () => actionSheetModal.style.display = 'none'); btnCancelForward.addEventListener('click', () => forwardModal.style.display = 'none');

btnClearChat.addEventListener('click', async () => {
    actionSheetModal.style.display = 'none'; if (!currentActiveRoomId) return;
    if (prompt('Type "CLEAR" to delete ALL messages in this room.') === "CLEAR") {
        try {
            const q = query(collection(db, currentRoomType, currentActiveRoomId, "messages")); const snapshot = await getDocs(q);
            const deletePromises = []; snapshot.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, currentRoomType, currentActiveRoomId, "messages", docSnap.id))));
            await Promise.all(deletePromises); alert("Chat cleared.");
        } catch (e) { alert("Failed to clear chat."); }
    }
});

multiForwardBtn.addEventListener('click', async () => {
    if (selectedMessages.size === 0) return;
    forwardContactList.innerHTML = '<p style="text-align:center;">Loading contacts...</p>'; forwardModal.style.display = 'flex';
    try {
        const snapshot = await getDocs(query(collection(db, "users", auth.currentUser.uid, "contacts")));
        forwardContactList.innerHTML = '';
        if (snapshot.empty) { forwardContactList.innerHTML = '<p style="text-align:center; color:#888;">No contacts.</p>'; return; }
        
        snapshot.forEach(async (docSnap) => {
            const contact = docSnap.data(); const isGroup = contact.isGroup || false; let partnerPhoto = null;
            if (!isGroup) { try { const pDoc = await getDoc(doc(db, "users", contact.uid)); if(pDoc.exists()) partnerPhoto = pDoc.data().photoUrl; } catch(e){} }
            const avatarContent = isGroup ? '👥' : (partnerPhoto ? '' : contact.name.charAt(0).toUpperCase());
            const avatarStyle = partnerPhoto ? `background-image: url(${partnerPhoto});` : '';
            const card = document.createElement('div'); card.classList.add('contact-card');
            card.innerHTML = `<div class="contact-avatar" style="${avatarStyle}">${avatarContent}</div><div class="contact-info"><span class="contact-name">${contact.name}</span></div>`;
            
            card.addEventListener('click', async () => {
                forwardModal.style.display = 'none'; 
                const targetRoom = isGroup ? contact.uid : getPrivateRoomId(auth.currentUser.uid, contact.uid);
                const targetType = isGroup ? "groups" : "chats";
                try {
                    const sortedMessages = Array.from(selectedMessages).sort((a, b) => a.data.createdAt - b.data.createdAt);
                    const forwardPromises = sortedMessages.map(msg => addDoc(collection(db, targetType, targetRoom, "messages"), {
                        text: msg.data.text || "", fileUrl: msg.data.fileUrl || null, fileType: msg.data.fileType || null,
                        senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp(), isForwarded: true, read: false
                    }));
                    await Promise.all(forwardPromises); toggleSelectionMode(false); alert(`Forwarded to ${contact.name}`);
                } catch(e) { alert("Failed to forward."); }
            });
            forwardContactList.appendChild(card);
        });
    } catch(e) {}
});

// ==========================================
// PROFILE VIEWER & LOCATION LOGIC
// ==========================================
let currentZoomLevel = 1;
function openProfileViewer(name, photoUrl) {
    if (!photoUrl) return; viewerName.textContent = name; viewerImage.style.backgroundImage = `url(${photoUrl})`;
    currentZoomLevel = 1; viewerImage.style.transform = `scale(${currentZoomLevel})`; profileViewerModal.style.display = 'flex';
}
chatPartnerAvatar.addEventListener('click', () => { if (currentPartnerDetails && currentPartnerDetails.photoUrl && !currentPartnerDetails.isGroup) openProfileViewer(currentPartnerDetails.name, currentPartnerDetails.photoUrl); });
contactList.addEventListener('click', (e) => {
    const avatarEl = e.target.closest('.contact-avatar');
    if (avatarEl) { e.stopPropagation(); const bgImage = avatarEl.style.backgroundImage; if (bgImage && bgImage !== 'none') openProfileViewer(avatarEl.closest('.contact-card').querySelector('.contact-name').textContent, bgImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')); }
});
zoomInBtn.addEventListener('click', () => { currentZoomLevel = Math.min(currentZoomLevel + 0.5, 3); viewerImage.style.transform = `scale(${currentZoomLevel})`; });
zoomOutBtn.addEventListener('click', () => { currentZoomLevel = Math.max(currentZoomLevel - 0.5, 1); viewerImage.style.transform = `scale(${currentZoomLevel})`; });
closeViewerBtn.addEventListener('click', () => profileViewerModal.style.display = 'none');
profileViewerModal.addEventListener('contextmenu', (e) => e.preventDefault());

locationBtn.addEventListener('click', () => {
    if (!auth.currentUser) return;
    if (watchId) {
        navigator.geolocation.clearWatch(watchId); watchId = null; locationBtn.style.color = ''; locationBtn.style.transform = 'scale(1)';
        setDoc(doc(db, "users", auth.currentUser.uid), { isSharingLocation: false }, { merge: true }); sendTextMessage("📍 Stopped sharing location.");
    } else {
        if (navigator.geolocation) {
            locationBtn.style.color = '#ff3b50'; locationBtn.style.transform = 'scale(1.2)'; sendTextMessage("📍 Started sharing location.");
            watchId = navigator.geolocation.watchPosition(async (position) => {
                await setDoc(doc(db, "users", auth.currentUser.uid), { isSharingLocation: true, location: { lat: position.coords.latitude, lng: position.coords.longitude } }, { merge: true });
            }, (e) => { alert("Allow location access."); locationBtn.style.color = ''; }, { enableHighAccuracy: true });
        } else alert("Geolocation not supported.");
    }
});

function listenToPartnerLocation(partnerUid) {
    if (unsubscribePartnerLocation) unsubscribePartnerLocation();
    unsubscribePartnerLocation = onSnapshot(doc(db, "users", partnerUid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().isSharingLocation && docSnap.data().location) {
            viewMapBtn.style.display = 'block'; const loc = docSnap.data().location;
            if (mapInstance && partnerMarker) { partnerMarker.setLatLng([loc.lat, loc.lng]); mapInstance.panTo([loc.lat, loc.lng]); }
        } else { viewMapBtn.style.display = 'none'; mapModal.style.display = 'none'; }
    });
}

viewMapBtn.addEventListener('click', async () => {
    mapModal.style.display = 'flex';
    setTimeout(() => {
        if (!mapInstance) { mapInstance = L.map('map-container').setView([0, 0], 16); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance); partnerMarker = L.marker([0, 0]).addTo(mapInstance); }
        mapInstance.invalidateSize(); 
        getDoc(doc(db, "users", currentPartnerDetails.uid)).then(docSnap => {
            if (docSnap.exists() && docSnap.data().location) {
                const loc = docSnap.data().location; partnerMarker.setLatLng([loc.lat, loc.lng]); mapInstance.panTo([loc.lat, loc.lng]); partnerMarker.bindPopup(`<b>${currentPartnerDetails.name}</b>`).openPopup();
            }
        });
    }, 300);
});
closeMapBtn.addEventListener('click', () => mapModal.style.display = 'none');

// ==========================================
// CHAT & MEDIA ENGINE
// ==========================================
function loadMessages(roomId) {
    const messagesQuery = query(collection(db, currentRoomType, roomId, "messages"), orderBy("createdAt"));
    let isInitialLoad = true; 
    if (unsubscribeMessages) unsubscribeMessages(); if (unsubscribeTyping) unsubscribeTyping();

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatBox.innerHTML = ''; let lastDate = null; 
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.senderId !== auth.currentUser.uid && data.read !== true && currentRoomType === "chats") {
                updateDoc(doc(db, currentRoomType, roomId, "messages", docSnap.id), { read: true }).catch(e=>e);
            }
            if (data.createdAt) {
                const msgDate = data.createdAt.toDate(); const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate() - 1); let dStr = "";
                if (msgDate.toDateString() === today.toDateString()) dStr = "Today"; else if (msgDate.toDateString() === yest.toDateString()) dStr = "Yesterday"; else dStr = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                if (dStr !== lastDate) { displayDateSeparator(dStr); lastDate = dStr; }
            }
            displayMessage(docSnap.id, data); 
        });
        
        if (!isInitialLoad) { snapshot.docChanges().forEach((change) => { if (change.type === "added" && change.doc.data().senderId !== auth.currentUser.uid) { notificationSound.play().catch(e=>e); if (!isTabActive) { unreadCount++; updateBadge(); } } }); }
        isInitialLoad = false; chatBox.scrollTop = chatBox.scrollHeight;
    });

    unsubscribeTyping = onSnapshot(doc(db, currentRoomType, roomId), (docSnap) => {
        if (docSnap.exists() && docSnap.data().typing) {
            const isAnyoneTyping = Object.keys(docSnap.data().typing).some(uid => docSnap.data().typing[uid] === true && uid !== auth.currentUser.uid);
            if (isAnyoneTyping) { typingIndicator.style.display = 'flex'; chatBox.scrollTop = chatBox.scrollHeight; } else { typingIndicator.style.display = 'none'; }
        } else { typingIndicator.style.display = 'none'; }
    });
}

function displayDateSeparator(dateText) {
    const div = document.createElement('div'); div.classList.add('date-separator'); const span = document.createElement('span'); span.textContent = dateText;
    div.appendChild(span); chatBox.appendChild(div);
}

async function sendTextMessage(text) {
    if (text && auth.currentUser && currentActiveRoomId) {
        try {
            setDoc(doc(db, currentRoomType, currentActiveRoomId), { typing: { [auth.currentUser.uid]: false } }, { merge: true });
            await addDoc(collection(db, currentRoomType, currentActiveRoomId, "messages"), { text: text, senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp(), read: false });
        } catch (error) {}
    }
}

messageInput.addEventListener('input', function() { 
    this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; 
    if (currentActiveRoomId && auth.currentUser) {
        setDoc(doc(db, currentRoomType, currentActiveRoomId), { typing: { [auth.currentUser.uid]: true } }, { merge: true });
        clearTimeout(typingTimeout); typingTimeout = setTimeout(() => setDoc(doc(db, currentRoomType, currentActiveRoomId), { typing: { [auth.currentUser.uid]: false } }, { merge: true }), 1500);
    }
});
messageInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const t = this.value.trim(); if (t) { sendTextMessage(t); this.value = ''; this.style.height = 'auto'; } } });
chatForm.addEventListener('submit', async (e) => { e.preventDefault(); const t = messageInput.value.trim(); if (t) { await sendTextMessage(t); messageInput.value = ''; messageInput.style.height = 'auto'; } });
emojiBtns.forEach(btn => btn.addEventListener('click', async () => await sendTextMessage(btn.textContent)));

async function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.src = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(img.src); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0);
            canvas.toBlob((b) => { if (b) resolve(new File([b], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })); else reject(); }, 'image/webp', 0.8); 
        }; img.onerror = () => { URL.revokeObjectURL(img.src); reject(); };
    });
}

async function handleFileUpload(file) {
    if (!file || !auth.currentUser || !currentActiveRoomId) return;
    if (file.size > (20 * 1024 * 1024)) { alert(`File too large (over 20MB).`); return; }
    let fileToUpload = file; if (file.type.startsWith('image/') && file.type !== 'image/webp') { try { fileToUpload = await convertToWebP(file); } catch (e) { } }
    const storageRef = ref(storage, `uploads/${currentActiveRoomId}/${Date.now()}_${fileToUpload.name}`);
    try {
        const snapshot = await uploadBytesResumable(storageRef, fileToUpload); const downloadURL = await getDownloadURL(snapshot.ref);
        let mText = `📎 ${fileToUpload.name}`; if (file.type.startsWith('image/')) mText = '📷 Photo'; if (file.type.startsWith('video/')) mText = '🎥 Video';
        await addDoc(collection(db, currentRoomType, currentActiveRoomId, "messages"), { text: mText, fileUrl: downloadURL, fileType: file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : 'file'), senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp(), read: false });
    } catch (error) { alert("Upload failed."); }
}

imageUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0])); videoUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0])); fileUpload.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(stream); mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType }); audioChunks = []; const storageRef = ref(storage, `uploads/${currentActiveRoomId}/voice_${Date.now()}.webm`);
                try {
                    const snapshot = await uploadBytesResumable(storageRef, audioBlob); const downloadURL = await getDownloadURL(snapshot.ref);
                    await addDoc(collection(db, currentRoomType, currentActiveRoomId, "messages"), { text: '🎤 Voice Message', fileUrl: downloadURL, fileType: 'audio', senderId: auth.currentUser.uid, senderName: auth.currentUser.displayName, createdAt: serverTimestamp(), read: false });
                } catch (e) {}
            }; mediaRecorder.start(); isRecording = true; micBtn.classList.add('recording'); micBtn.textContent = '⏹️'; 
        } catch (err) { alert("Microphone access denied."); }
    } else { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); isRecording = false; micBtn.classList.remove('recording'); micBtn.textContent = '🎤'; }
});

function displayMessage(msgId, data) {
    const isMe = data.senderId === auth.currentUser.uid;
    const rowDiv = document.createElement('div'); rowDiv.classList.add('message-wrapper'); rowDiv.style.justifyContent = isMe ? 'flex-end' : 'flex-start';
    const checkboxDiv = document.createElement('div'); checkboxDiv.classList.add('message-checkbox'); rowDiv.appendChild(checkboxDiv);
    
    const bubbleWrapper = document.createElement('div'); bubbleWrapper.style.display = 'flex'; bubbleWrapper.style.flexDirection = 'column'; bubbleWrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start'; bubbleWrapper.style.maxWidth = '75%';
    if (!isMe && data.senderName && currentRoomType === "groups") { const nameLabel = document.createElement('span'); nameLabel.classList.add('sender-name'); nameLabel.textContent = data.senderName; bubbleWrapper.appendChild(nameLabel); }

    const messageDiv = document.createElement('div'); messageDiv.classList.add('message', isMe ? 'sent' : 'received');
    if (data.isForwarded) { const fwdSpan = document.createElement('span'); fwdSpan.classList.add('forwarded-tag'); fwdSpan.textContent = '➡️ Forwarded'; messageDiv.appendChild(fwdSpan); }
    
    if (data.fileUrl) {
        if (data.fileType === 'image') { const img = document.createElement('img'); img.src = data.fileUrl; messageDiv.appendChild(img);
        } else if (data.fileType === 'audio') { const audioEl = document.createElement('audio'); audioEl.controls = true; audioEl.src = data.fileUrl; messageDiv.appendChild(audioEl);
        } else if (data.fileType === 'video') { const videoEl = document.createElement('video'); videoEl.controls = true; videoEl.src = data.fileUrl; videoEl.preload = "metadata"; messageDiv.appendChild(videoEl);
        } else { const link = document.createElement('a'); link.href = data.fileUrl; link.target = "_blank"; link.textContent = data.text; messageDiv.appendChild(link); }
    } else { messageDiv.appendChild(document.createTextNode(data.text)); }

    const timeSpan = document.createElement('span'); timeSpan.classList.add('timestamp');
    let timeText = data.createdAt ? data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending..."; 
    let statusIndicator = '';
    if (isMe && data.createdAt && currentRoomType === "chats") { if (data.read) { statusIndicator = '<span class="msg-status read">✓✓</span>'; } else { statusIndicator = '<span class="msg-status sent">✓</span>'; } }
    timeSpan.innerHTML = timeText + statusIndicator;
    messageDiv.appendChild(timeSpan); bubbleWrapper.appendChild(messageDiv); rowDiv.appendChild(bubbleWrapper); chatBox.appendChild(rowDiv);

    const toggleThisMessage = () => {
        const msgObj = { id: msgId, data: data }; let existingObj = null;
        for (let item of selectedMessages) { if (item.id === msgId) existingObj = item; }
        if (existingObj) { selectedMessages.delete(existingObj); rowDiv.classList.remove('selected'); } else { selectedMessages.add(msgObj); rowDiv.classList.add('selected'); }
        updateSelectionHeader(); if (selectedMessages.size === 0) toggleSelectionMode(false);
    };

    rowDiv.addEventListener('click', (e) => { if (isSelectionMode) { e.preventDefault(); toggleThisMessage(); } });
    let pressTimer; const startPress = () => { if (isSelectionMode) return; pressTimer = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(50); toggleSelectionMode(true); toggleThisMessage(); }, 600); }; const cancelPress = () => clearTimeout(pressTimer);
    rowDiv.addEventListener('mousedown', startPress); rowDiv.addEventListener('mouseup', cancelPress); rowDiv.addEventListener('mouseleave', cancelPress);
    rowDiv.addEventListener('touchstart', startPress, {passive: true}); rowDiv.addEventListener('touchend', cancelPress); rowDiv.addEventListener('touchmove', cancelPress, {passive: true});
}