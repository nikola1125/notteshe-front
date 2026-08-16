import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const adminRoleEnum = pgEnum("admin_role", ["SUPERADMIN", "MANAGER"]);

export const discountTypeEnum = pgEnum("discount_type", ["PERCENT", "FIXED"]);

// ─── Better Auth tables ──────────────────────────────────────────────────────
// Field names must match exactly what Better Auth expects.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Address ─────────────────────────────────────────────────────────────────

export const address = pgTable("address", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Category ────────────────────────────────────────────────────────────────

export const category = pgTable("category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id"), // self-referential, no FK to allow null
  sortOrder: integer("sort_order").notNull().default(0), // manual display order
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Collection ──────────────────────────────────────────────────────────────

export const collection = pgTable("collection", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  coverCloudflareId: text("cover_cloudflare_id"),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  homeCaption: text("home_caption"),           // optional label override on homepage tile
  homeCaptionMeta: text("home_caption_meta"),   // optional decorative meta, e.g. "04:12 pm"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Home Collections (singleton row, id = 'default') ─────────────────────────
// The three curated collections shown in the homepage composition, in slot order.

export const homeCollections = pgTable("home_collections", {
  id: text("id").primaryKey().default("default"),
  slot1CollectionId: text("slot1_collection_id").references(() => collection.id, { onDelete: "set null" }),
  slot2CollectionId: text("slot2_collection_id").references(() => collection.id, { onDelete: "set null" }),
  slot3CollectionId: text("slot3_collection_id").references(() => collection.id, { onDelete: "set null" }),
  // Flexible landing layout: ordered rows, each holding collection ids per cell.
  layout: jsonb("layout").$type<{ id: string; type: string; items: (string | null)[] }[]>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Product ─────────────────────────────────────────────────────────────────

export const product = pgTable("product", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  details: jsonb("details").$type<string[]>().notNull().default([]),
  categoryId: text("category_id").references(() => category.id, { onDelete: "set null" }),
  collectionId: text("collection_id").references(() => collection.id, { onDelete: "set null" }),
  price: real("price").notNull(),
  originalPrice: real("original_price"),             // null = no sale
  inStock: boolean("in_stock").notNull().default(true),
  isNew: boolean("is_new").notNull().default(false),
  isSale: boolean("is_sale").notNull().default(false),
  isPermanentWardrobe: boolean("is_permanent_wardrobe").notNull().default(false),
  wardrobeOrder: integer("wardrobe_order").notNull().default(0), // manual order on homepage wardrobe
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("product_category_idx").on(t.categoryId),
  index("product_collection_idx").on(t.collectionId),
  index("product_visible_idx").on(t.isVisible),
  index("product_new_idx").on(t.isNew),
  index("product_sale_idx").on(t.isSale),
]);

// ─── Product Image ────────────────────────────────────────────────────────────

export const productImage = pgTable("product_image", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  cloudflareId: text("cloudflare_id").notNull(),
  url: text("url").notNull(),
  order: integer("order").notNull().default(0),
  isCover: boolean("is_cover").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("product_image_product_idx").on(t.productId),
]);

// ─── Product Size ─────────────────────────────────────────────────────────────

export const productSize = pgTable("product_size", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  available: boolean("available").notNull().default(true),
  stock: integer("stock").notNull().default(0),
}, (t) => [
  index("product_size_product_idx").on(t.productId),
]);

// ─── Product Colour ───────────────────────────────────────────────────────────

export const productColour = pgTable("product_colour", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hex: text("hex").notNull(),
  order: integer("order").notNull().default(0),
}, (t) => [
  index("product_colour_product_idx").on(t.productId),
]);

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export const wishlistItem = pgTable("wishlist_item", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("wishlist_user_product_idx").on(t.userId, t.productId),
]);

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  subtotal: real("subtotal").notNull(),
  shippingFee: real("shipping_fee").notNull().default(0),
  paymentFee: real("payment_fee").notNull().default(0),
  discountCode: text("discount_code"),
  discountAmount: real("discount_amount").notNull().default(0),
  giftCardCode: text("gift_card_code"),
  giftCardAmountLek: real("gift_card_amount_lek").notNull().default(0),
  total: real("total").notNull(),
  // Currency the order was charged in, and the exact amount sent to POK in that
  // currency. `total`/`subtotal`/etc. stay in EUR base; these capture what POK took.
  currency: text("currency").notNull().default("EUR"),
  pokAmount: real("pok_amount"),
  // Frozen copy of shipping address at order time
  shippingAddress: jsonb("shipping_address").notNull(),
  pokOrderId: text("pok_order_id").unique(),
  adminNote: text("admin_note"),
  trackingNumber: text("tracking_number"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_user_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
  index("orders_created_idx").on(t.createdAt),
]);

// ─── Order Item ───────────────────────────────────────────────────────────────

export const orderItem = pgTable("order_item", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => product.id, { onDelete: "set null" }),
  // Frozen snapshot so order history survives product edits/deletes
  productSnapshot: jsonb("product_snapshot").notNull(),
  size: text("size").notNull(),
  colour: text("colour").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

// ─── Shipping Config (singleton row, id = 'default') ─────────────────────────

export const shippingConfig = pgTable("shipping_config", {
  id: text("id").primaryKey().default("default"),
  enabled: boolean("enabled").notNull().default(true),
  fee: real("fee").notNull().default(12),
  freeThreshold: real("free_threshold").notNull().default(200),
  // Payment processing fee passed to customer
  paymentFeeEnabled: boolean("payment_fee_enabled").notNull().default(false),
  paymentFeePercent: real("payment_fee_percent").notNull().default(0),
  paymentFeeFixed: real("payment_fee_fixed").notNull().default(0),
  // Currency: EUR is the base/source-of-truth price; Lek is derived from this rate.
  eurToLekRate: real("eur_to_lek_rate").notNull().default(100),
  lekRounding: integer("lek_rounding").notNull().default(100), // round Lek prices to nearest N
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Admin User ───────────────────────────────────────────────────────────────

export const adminUser = pgTable("admin_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: adminRoleEnum("role").notNull().default("MANAGER"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// ─── Admin Session ────────────────────────────────────────────────────────────

export const adminSession = pgTable("admin_session", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull().references(() => adminUser.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("admin_session_token_idx").on(t.token),
]);

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").references(() => adminUser.id, { onDelete: "set null" }),
  action: text("action").notNull(),       // e.g. "product.update", "order.status_change"
  entityType: text("entity_type"),        // e.g. "product", "order"
  entityId: text("entity_id"),
  diff: jsonb("diff").$type<{ before?: unknown; after?: unknown } | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_admin_idx").on(t.adminId),
  index("audit_log_entity_idx").on(t.entityType, t.entityId),
  index("audit_log_created_idx").on(t.createdAt),
]);

// ─── Pending Order (pre-payment reservation, deleted on order creation) ───────

export const pendingOrder = pgTable("pending_order", {
  id: text("id").primaryKey(),               // == merchantReference UUID sent to POK
  pokOrderId: text("pok_order_id").notNull().unique(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orderData: jsonb("order_data").notNull(),   // full PlaceOrderSchema payload
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("pending_order_pok_idx").on(t.pokOrderId),
  index("pending_order_user_idx").on(t.userId),
  index("pending_order_expires_idx").on(t.expiresAt),
]);

// ─── Discount Code ────────────────────────────────────────────────────────────

export const discountCode = pgTable("discount_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: discountTypeEnum("type").notNull(),
  value: real("value").notNull(),          // percent (0–100) or fixed (€)
  minOrderAmount: real("min_order_amount"),
  maxUses: integer("max_uses"),            // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Newsletter Subscriber ────────────────────────────────────────────────────

export const newsletterSubscriber = pgTable("newsletter_subscriber", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  source: text("source").default("website"),  // "website", "checkout", "popup"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Saved Card (POK tokenized cards for returning customers) ────────────────

export const savedCard = pgTable("saved_card", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  pokCardId: text("pok_card_id").notNull().unique(),
  brand: text("brand"),
  lastFour: text("last_four"),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("saved_card_user_idx").on(t.userId),
]);

// ─── Order Cancellation Requests ─────────────────────────────────────────────

export const cancellationRequest = pgTable("cancellation_request", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Admin Events (real-time SSE queue, TTL ~1h) ─────────────────────────────

export const adminEvent = pgTable("admin_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("admin_event_created_idx").on(t.createdAt),
]);

// ─── Contact Messages ─────────────────────────────────────────────────────────

export const contactMessage = pgTable("contact_message", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Gift Card ────────────────────────────────────────────────────────────────

export const giftCard = pgTable("gift_card", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),          // NOTT-XXXX-XXXX-XXXX
  initialAmount: real("initial_amount").notNull(), // Lek face value
  balance: real("balance").notNull(),              // Lek remaining
  status: text("status").notNull().default("active"), // active|depleted|disabled|expired
  purchaserUserId: text("purchaser_user_id").references(() => user.id, { onDelete: "set null" }),
  purchaserEmail: text("purchaser_email").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  message: text("message"),
  sourceOrderId: text("source_order_id"),          // order that purchased this card
  issuedByAdminId: text("issued_by_admin_id").references(() => adminUser.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (t) => [
  index("gift_card_code_idx").on(t.code),
  index("gift_card_status_idx").on(t.status),
  index("gift_card_purchaser_idx").on(t.purchaserUserId),
]);

// ─── Gift Card Transaction (append-only ledger) ───────────────────────────────

export const giftCardTransaction = pgTable("gift_card_transaction", {
  id: text("id").primaryKey(),
  giftCardId: text("gift_card_id").notNull().references(() => giftCard.id, { onDelete: "cascade" }),
  // issue: +amount (issued), redeem: −amount (spent), refund: +amount (credited back),
  // adjust: signed (admin manual), expire: −balance (zeroed on expiry)
  type: text("type").notNull(),
  amount: real("amount").notNull(),               // signed Lek
  balanceAfter: real("balance_after").notNull(),  // Lek balance after this tx
  orderId: text("order_id"),
  adminId: text("admin_id").references(() => adminUser.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("gc_tx_gift_card_idx").on(t.giftCardId),
  index("gc_tx_order_idx").on(t.orderId),
  index("gc_tx_created_idx").on(t.createdAt),
]);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type GiftCard = typeof giftCard.$inferSelect;
export type GiftCardTransaction = typeof giftCardTransaction.$inferSelect;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Address = typeof address.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Collection = typeof collection.$inferSelect;
export type HomeCollections = typeof homeCollections.$inferSelect;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductImage = typeof productImage.$inferSelect;
export type ProductSize = typeof productSize.$inferSelect;
export type ProductColour = typeof productColour.$inferSelect;
export type WishlistItem = typeof wishlistItem.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItem.$inferSelect;
export type ShippingConfig = typeof shippingConfig.$inferSelect;
export type AdminUser = typeof adminUser.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type PendingOrder = typeof pendingOrder.$inferSelect;
export type DiscountCode = typeof discountCode.$inferSelect;
export type SavedCard = typeof savedCard.$inferSelect;
