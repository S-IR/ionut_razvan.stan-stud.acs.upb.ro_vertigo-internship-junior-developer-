// import { eq, and, sum, countDistinct, asc, desc, inArray, SQL, count, } from "drizzle-orm";
// import db from "../db";
// import { usersTable, marketsTable, marketOutcomesTable, betsTable, usersRelations } from "../db/schema";
// import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
// import {
//   validateRegistration,
//   validateLogin,
//   validateMarketCreation,
//   validateBet,
// } from "../lib/validation";
// import { broadcastNewMarket, broadcastSingleMarketUpdate, SORT_BY_OPTION } from "./markets.routes";
// import { type Context } from "elysia";
// import { assert, assertBet, assertEnrichedOutcome, assertMarket, assertOutcome, assertUser } from "../lib/assert";
// import { broadcastNewBet, broadcastUserProfileUpdate } from "./users.routes";

// type JwtSigner = {
//   sign: (payload: Record<string, string | number>) => Promise<string>;
//   verify: (token?: string) => Promise<Record<string, string | number> | false>;
// };

// type AuthContext<TBody> = Context<{ body: TBody }> & {
//   jwt: JwtSigner;
// };

// // 7 days



