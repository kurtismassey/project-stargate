/* https://firebase.google.com/codelabs/firebase-nextjs#5 */
import { initializeApp } from "firebase/app";
import { getAuth, getIdToken } from "firebase/auth";
import { getInstallations, getToken } from "firebase/installations";

const firebaseConfig = {
  apiKey: "AIzaSyAZmPN5mfRx6hAf9JnqRsTtteXob0-2GFg",
  authDomain: "project-stargate-web.firebaseapp.com",
  projectId: "project-stargate-web",
  storageBucket: "project-stargate-web.appspot.com",
  messagingSenderId: "646512050048",
  appId: "1:646512050048:web:f83be9c94d256ce394cb65",
  measurementId: "G-KY5DM20JC3",
};

self.addEventListener("fetch", (event) => {
  const { origin } = new URL(event.request.url);
  if (origin !== self.location.origin) return;
  event.respondWith(fetchWithFirebaseHeaders(event.request));
});

async function fetchWithFirebaseHeaders(request) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const installations = getInstallations(app);
  const headers = new Headers(request.headers);
  const [authIdToken, installationToken] = await Promise.all([
    getAuthIdToken(auth),
    getToken(installations),
  ]);
  headers.append("Firebase-Instance-ID-Token", installationToken);
  if (authIdToken) headers.append("Authorization", `Bearer ${authIdToken}`);
  const newRequest = new Request(request, { headers });
  return await fetch(newRequest);
}

async function getAuthIdToken(auth) {
  await auth.authStateReady();
  if (!auth.currentUser) return;
  return await getIdToken(auth.currentUser);
}
