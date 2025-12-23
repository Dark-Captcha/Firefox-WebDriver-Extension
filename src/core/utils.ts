/**
 * @fileoverview Utility functions for Firefox WebDriver extension.
 * @module core/utils
 */

// ============================================================================
// Implementation
// ============================================================================

/**
 * Converts a wildcard pattern to a RegExp.
 *
 * @param pattern - URL pattern with wildcards (* and ?)
 * @returns RegExp for matching
 *
 * @example
 *     const regex = patternToRegex("*.example.com/*");
 *     regex.test("www.example.com/page"); // true
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

/**
 * Generates a UUID v4.
 *
 * @returns UUID string
 *
 * @example
 *     const id = generateUUID();
 *     // "550e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      ""
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Exports
// ============================================================================

export { patternToRegex, generateUUID };
