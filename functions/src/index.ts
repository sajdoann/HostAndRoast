/**
 * Cloud Functions for Host & Roast — placeholder.
 *
 * The booking + payment flow lives here so secret keys never touch the client:
 *
 *   createCheckoutSession  — guest books a seat → creates a Stripe Checkout session.
 *   stripeWebhook          — Stripe confirms payment → write the booking to Firestore,
 *                            decrement the dinner's seatsLeft.
 *
 * TODO(functions):
 *   1. cd functions && npm install stripe
 *   2. firebase functions:config:set stripe.secret="sk_..." stripe.webhook="whsec_..."
 *   3. Implement the two handlers below and remove this notice.
 */

import * as admin from "firebase-admin";

admin.initializeApp();

// import { onCall } from "firebase-functions/v2/https";
// import { onRequest } from "firebase-functions/v2/https";
// import Stripe from "stripe";
//
// export const createCheckoutSession = onCall(async (request) => {
//   // 1. Validate the dinner + seat availability.
//   // 2. Create a Stripe Checkout session for the seat price.
//   // 3. Return the session id / url to the client.
// });
//
// export const stripeWebhook = onRequest(async (req, res) => {
//   // 1. Verify the Stripe signature.
//   // 2. On checkout.session.completed, write the booking + decrement seats.
//   res.sendStatus(200);
// });

export {};
