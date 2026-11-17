import { openUrl } from "@tauri-apps/plugin-opener";
import { onUrl, start } from "@fabianlars/tauri-plugin-oauth";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const scope =
  "https://www.googleapis.com/auth/drive.file openid email profile";
const backupName = "notary-backup.db";

let accessToken;
let tokenExpiresAt = 0;
let oauthPort;

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

async function requestAccessToken() {
  if (!clientId) {
    throw new Error(
      "Google Drive ist noch nicht konfiguriert. Bitte VITE_GOOGLE_CLIENT_ID setzen.",
    );
  }
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    throw new Error(
      "Bitte die Google OAuth-Client-ID verwenden, nicht das Client-Secret.",
    );
  }

  const { verifier, challenge } = await createPkce();
  const state = base64Url(randomBytes(24));
  oauthPort ??= await start();
  const redirectUri = `http://127.0.0.1:${oauthPort}`;

  let resolveCallback;
  let rejectCallback;
  const callback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const unlisten = await onUrl((url) => {
    try {
      const callbackUrl = new URL(url);
      if (callbackUrl.searchParams.get("state") !== state) {
        rejectCallback(new Error("Ungültige Google-Anmeldeantwort."));
        return;
      }
      if (callbackUrl.searchParams.get("error")) {
        rejectCallback(new Error("Google-Anmeldung wurde abgebrochen."));
        return;
      }
      resolveCallback(callbackUrl.searchParams.get("code"));
    } finally {
      unlisten?.();
    }
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  await openUrl(authUrl.toString());

  const code = await callback;
  oauthPort = undefined;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Google-Token konnte nicht abgerufen werden (${response.status}): ${details}`,
    );
  }
  const tokens = await response.json();
  accessToken = tokens.access_token;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
  return accessToken;
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }
  return requestAccessToken();
}

export function isGoogleDriveConfigured() {
  return Boolean(clientId);
}

export async function getGoogleAccount() {
  return JSON.parse(localStorage.getItem("googleDriveAccount") || "null");
}

export async function connectGoogleDrive() {
  await requestAccessToken("select_account");
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Google-Konto konnte nicht gelesen werden (${response.status}): ${details}`,
    );
  }
  const profile = await response.json();
  const account = { email: profile.email, name: profile.name };
  localStorage.setItem("googleDriveAccount", JSON.stringify(account));
  return account;
}

async function findBackup() {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${backupName}' and trashed = false`,
    )}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Google-Drive-Datei konnte nicht gesucht werden.");
  return (await response.json()).files?.[0] ?? null;
}

export async function uploadDatabase(bytes) {
  const token = await getAccessToken();
  const existing = await findBackup();
  const boundary = `notary-${Date.now()}`;
  const metadata = JSON.stringify({
    name: backupName,
    mimeType: "application/x-sqlite3",
  });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`,
    new Uint8Array(bytes),
    `\r\n--${boundary}--`,
  ]);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) throw new Error(`Google-Drive-Backup fehlgeschlagen (${response.status}).`);
}

export async function downloadDatabase() {
  const backup = await findBackup();
  if (!backup) throw new Error("Es wurde noch kein Notary-Backup in Google Drive gefunden.");
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${backup.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`Google-Drive-Import fehlgeschlagen (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export function disconnectGoogleDrive() {
  if (accessToken) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: "POST",
    }).catch(() => {});
  }
  accessToken = undefined;
  tokenExpiresAt = 0;
  localStorage.removeItem("googleDriveAccount");
}
