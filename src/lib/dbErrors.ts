export const getSchemaSetupMessage = (message: string): string | null => {
    const normalized = message.toLowerCase();
    if (!normalized.includes("could not find the table")) {
        return null;
    }

    return "Database schema is not initialized yet. Run supabase/bootstrap_users.sql in Supabase SQL Editor, then refresh.";
};
