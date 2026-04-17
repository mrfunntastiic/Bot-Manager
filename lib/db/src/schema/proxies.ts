import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const proxiesTable = pgTable("proxies", {
  id: serial("id").primaryKey(),
  proxy: text("proxy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Proxy = typeof proxiesTable.$inferSelect;
