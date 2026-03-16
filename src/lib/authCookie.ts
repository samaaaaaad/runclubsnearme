const AUTH_COOKIE_NAME = "sb-auth-token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function setAuthCookie() {
    if (typeof document === "undefined") return;

    document.cookie = `${AUTH_COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAuthCookie() {
    if (typeof document === "undefined") return;

    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
