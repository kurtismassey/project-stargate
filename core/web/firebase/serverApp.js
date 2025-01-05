import "server-only";

import { initializeServerApp } from "firebase/app";

import { firebaseConfig } from "./config";
import { getAuth } from "firebase/auth";

export async function getAuthenticatedAppForUser(idToken) {
  const firebaseServerApp = initializeServerApp(
    firebaseConfig,
    idToken ? { authIdToken: idToken } : {},
  );

  const auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  return { firebaseServerApp, currentUser: auth.currentUser };
}
