export function encodeJsonForUrl(value: unknown): string {
  const json = JSON.stringify(value);
  // UTF-8 safe base64 encoding for client-side URLs
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
}

export function decodeJsonFromUrl<T = unknown>(encoded: string): T | null {
  try {
    const json = decodeURIComponent(
      atob(decodeURIComponent(encoded))
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch (error) {
    console.error("Failed to decode URL JSON", error);
    return null;
  }
}
