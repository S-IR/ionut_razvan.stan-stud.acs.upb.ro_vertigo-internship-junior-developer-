// lib/apiKeys.ts
import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { raw: string; hash: string } {
    const raw = "pm_" + randomBytes(32).toString("hex"); // "pm_<64 hex chars>"
    const hash = createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}

export function hashApiKey(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}