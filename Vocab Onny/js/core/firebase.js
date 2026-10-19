/* =========================================
   FIREBASE APP
========================================= */

import {
  initializeApp
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";


/* =========================================
   FIREBASE AUTH
========================================= */

import {
  getAuth
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


/* =========================================
   FIRESTORE
========================================= */

import {
  getFirestore
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================
   CONFIG
========================================= */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCeOg2vMGO5TKLCB3KhVqtEAG4b1a9_pek",
  authDomain: "vocab-onny.firebaseapp.com",
  projectId: "vocab-onny",
  storageBucket: "vocab-onny.firebasestorage.app",
  messagingSenderId: "613853981704",
  appId: "1:613853981704:web:0d3c0ee159a209dd4bf5bd",
  measurementId: "G-CSQYGFRZSE"
};


/* =========================================
   INITIALIZE
========================================= */

const app =
  initializeApp(
    firebaseConfig
  );


const auth =
  getAuth(
    app
  );


const db =
  getFirestore(
    app
  );


/* =========================================
   EXPORT
========================================= */

export {
  app,
  auth,
  db
};