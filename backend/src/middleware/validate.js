// src/middleware/validate.js
//
// WHY VALIDATE INPUT AT ALL:
// Your route handler should NEVER trust req.body directly. Without validation,
// someone could send { "amount": -999999 } to a "buy ticket" endpoint, or
// { "amount": "lots please" } and crash your SQL query, or send 500 fields
// of junk to slow down your server. Zod lets you define the SHAPE you expect,
// and rejects anything that doesn't match — before it touches your database
// or business logic.
//
// Pattern used here: define a schema per endpoint, then a generic middleware
// factory `validate(schema)` that any route can plug in.

const { z } = require("zod");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data; // use the parsed/coerced data downstream
    next();
  };
}

// ---- Schemas for each endpoint ----

const telegramLoginSchema = z.object({
  initData: z.string().min(1, "initData is required"),
  referralCode: z.string().trim().max(32).optional(), // optional "?ref=XYZ" deep link param
});

const buyTicketSchema = z.object({
  drawDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "drawDate must be YYYY-MM-DD")
    .optional(), // optional — defaults to "today" server-side if omitted
});

const withdrawSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM wallet address (0x + 40 hex chars)"),
  amountCoins: z
    .number()
    .int("Must be a whole number")
    .positive("Must be positive"),
});

const spinSchema = z.object({}); // no body needed, but kept for consistency / future fields

module.exports = {
  validate,
  telegramLoginSchema,
  buyTicketSchema,
  withdrawSchema,
  spinSchema,
};
