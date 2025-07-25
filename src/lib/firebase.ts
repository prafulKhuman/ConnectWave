import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
  projectId: "connectwave-6mfth",
  appId: "1:833165766531:web:2435082a79fd6f098c50b6",
  storageBucket: "connectwave-6mfth.firebasestorage.app",
  apiKey: "AIzaSyBPcxs52oOTHm42VGbagazgQUKgVCzKV08",
  authDomain: "connectwave-6mfth.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "833165766531"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const setupRecaptcha = (phone: string) => {
    const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response: any) => {
          console.log('reCAPTCHA solved, automatically submitting form now.');
        }
    });
    return recaptchaVerifier;
}


export { app, auth, setupRecaptcha };
