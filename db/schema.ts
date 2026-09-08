import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const votes = sqliteTable(
  'votes',
  {
    session: text('session').notNull(),
    voter: text('voter').notNull(),
    candidate: text('candidate').notNull(),
    minutes: integer('minutes').notNull().default(60),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.session, t.voter] })],
);
