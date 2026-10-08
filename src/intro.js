/*
 * WHAT THIS IS
 * ------------
 * A layout pass over the live game. It moves nothing off-screen and deletes nothing: every
 * change is either a CSS rule keyed on an attribute of <html>, or a node this script owns and
 * removes again. Turning a switch off restores the original page.
 *
 * It talks to no third-party service. Everything it shows is read from the page itself or from
 * the game's own public endpoints.
 *
 * THE IDEA BEHIND IT
 * ------------------
 * Two problems with the stock layout, and one rule that follows from them:
 *
 *   1. Leaving the board costs you the board. Dailies, Inventory, Leaderboards, Profile and Shop
 *      are ordinary page loads, so opening one tears down the running game and rebuilds it when
 *      you come back. They are opened in an overlay here instead; the game keeps running behind
 *      it, and the second visit is instant because the frame is kept.
 *
 *   2. The footer had eleven buttons in a row and the header had four cards that looked like
 *      read-outs. Everything was reachable and nothing was findable.
 *
 *   The rule: anything removed from the footer must reappear somewhere that says what it is.
 *   The header cards therefore carry labels — Gold is the way to the shop, Diamonds to the
 *   packages, your name to your account, the tileset card to the schedule. A card that opens
 *   something has to say so, or this is a downgrade for anyone who does not already know the
 *   layout by heart.
 *
 * ANCHORS
 * -------
 * Everything is found through the game's own data-role attributes. They are stable across
 * builds; class names are not (they carry build hashes).
 */

(function () {
    'use strict';

