importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCDCSBEZfTSb02oBe1o2ahU3FjXci-gLvc",
  authDomain: "my-private-chat-127db.firebaseapp.com",
  projectId: "my-private-chat-127db",
  storageBucket: "my-private-chat-127db.firebasestorage.app",
  messagingSenderId: "195855730116",
  appId: "1:195855730116:web:c0f28fd734ce36acb09091"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/love-logo.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});