const STORAGE_KEY = "hamper.adminAuthorization";

let authorization: string | null = null;
let storageRead = false;

export function getAdminAuthorization(): string | null {
  if (!storageRead) {
    storageRead = true;
    try {
      authorization = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Login still works in memory if the browser blocks session storage.
    }
  }
  return authorization;
}

export function saveAdminAuthorization(value: string) {
  authorization = value;
  storageRead = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Retain the verified credentials for the current page in memory.
  }
}

export function clearAdminAuthorization() {
  authorization = null;
  storageRead = true;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing the in-memory credentials is enough when storage is unavailable.
  }
}

export function createBasicAuthorization(login: string, password: string) {
  if (login.includes(":"))
    throw new Error("Логин не должен содержать двоеточие.");
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  const encoded = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
  );
  return `Basic ${encoded}`;
}
