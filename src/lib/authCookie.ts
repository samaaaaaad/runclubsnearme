const AUTH_COOKIE_NAME = "sb-auth-token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function setAuthCookie() {
    if (typeof document === "undefined") return;

    try {
        document.cookie = `${AUTH_COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch {
        // Ignore sandboxed-browser cookie errors; Supabase auth still works via its own storage.
    }
}

export function clearAuthCookie() {
    if (typeof document === "undefined") return;

    try {
        document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
        // Ignore sandboxed-browser cookie errors.
    }
}
