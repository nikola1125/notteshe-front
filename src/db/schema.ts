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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  discountCode: text("discount_code"),
  discountAmount: real("discount_amount").notNull().default(0),
  total: real("total").notNull(),
  // Frozen copy of shipping address at order time
  shippingAddress: jsonb("shipping_address").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  adminNote: text("admin_note"),
  trackingNumber: text("tracking_number"),
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

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Address = typeof address.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Collection = typeof collection.$inferSelect;
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
export type DiscountCode = typeof discountCode.$inferSelect;
