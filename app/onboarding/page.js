import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { serverConfig, clientConfig } from "@/config";
import Onboarding from "@/components/Onboarding";

export default async function OnboardingPath() {
  
  const tokens = await getTokens(cookies(), {
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    serviceAccount: serverConfig.serviceAccount,
  });

  return <Onboarding initialUser={tokens?.decodedToken} />
}