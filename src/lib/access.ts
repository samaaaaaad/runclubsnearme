export const ADMIN_EMAILS = ["a.samad4651@gmail.com"];

export const isAdminEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
