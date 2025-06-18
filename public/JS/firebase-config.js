// JS/firebase-config.js

// PEGA AQUÍ TU OBJETO DE CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDB_JKoxom-52iUCOLURhA-pUx1xEHyJwM",
  authDomain: "contauno-b2072.firebaseapp.com",
  projectId: "contauno-b2072",
  storageBucket: "contauno-b2072.firebasestorage.app",
  messagingSenderId: "792795471453",
  appId: "1:792795471453:web:a1044b78174e65f80377b4"
};

// ======================================================
// NO CAMBIES NADA DEBAJO DE ESTA LÍNEA
// ======================================================

// Inicializar los servicios de Firebase para usarlos en toda la app.
// Se usan 'const' porque estas referencias no cambiarán.
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // 'db' se declara y asigna aquí como una constante global.