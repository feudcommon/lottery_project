// src/middleware/validate.js
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
    req.body = result.data;
    next();
  };
}

const telegramLoginSchema = z.object({
  initData: z.string().min(1, "initData is required"),
  referralCode: z.string().trim().max(32).optional(),
});

const browserTelegramLoginSchema = z.object({
  id: z.union([z.string(), z.number()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]),
  hash: z.string().length(64),
  referralCode: z.string().trim().max(32).optional(),
});

const buyTicketSchema = z.object({
  drawDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "drawDate must be YYYY-MM-DD")
    .optional(),
  slotNumber: z
    .number()
    .int("slotNumber must be a whole number")
    .min(0, "slotNumber must be between 0 and 49")
    .max(49, "slotNumber must be between 0 and 49")
    .optional(),
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

const spinSchema = z.object({});

const depositSchema = z.object({
  txHash: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid transaction hash (0x + 64 hex chars)"),
});

module.exports = {
  validate,
  telegramLoginSchema,
  browserTelegramLoginSchema,
  buyTicketSchema,
  withdrawSchema,
  spinSchema,
  depositSchema,
};
