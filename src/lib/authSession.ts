import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const RETRY_DELAYS_MS = [0, 120, 240, 400];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getStableAuthUser(): Promise<User | null> {
    for (const delay of RETRY_DELAYS_MS) {
        if (delay > 0) {
            await sleep(delay);
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            return user;
        }

        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
            return session.user;
        }
    }

    return null;
}
