const STORAGE_KEY = "smart-poker-user-id";
const NAME_KEY = "smart-poker-display-name";

export function getGuestUserId(): string {
  if (typeof window === "undefined") return "guest-ssr";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === "undefined") return "Player";
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = `Player ${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

export function setDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
