/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as game from "../game.js";
import type * as lib_game_engine from "../lib/game/engine.js";
import type * as lib_poker_deck from "../lib/poker/deck.js";
import type * as lib_poker_evaluator from "../lib/poker/evaluator.js";
import type * as lib_poker_types from "../lib/poker/types.js";
import type * as rooms from "../rooms.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  game: typeof game;
  "lib/game/engine": typeof lib_game_engine;
  "lib/poker/deck": typeof lib_poker_deck;
  "lib/poker/evaluator": typeof lib_poker_evaluator;
  "lib/poker/types": typeof lib_poker_types;
  rooms: typeof rooms;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
