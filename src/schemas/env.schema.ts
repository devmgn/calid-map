import { z } from "zod";

/**
 * 環境変数のスキーマ定義
 */
export const envSchema = z
  .object({
    /** サイトURL */
    SITE_URL: z.url(),
    /** アプリケーション名 */
    APP_NAME: z.string(),
    /** デフォルトのdescription */
    DEFAULT_DESCRIPTION: z.string(),
    /** Google Maps APIキー */
    GOOGLE_MAPS_API_KEY: z.string().default(""),
    /** Supabase direct connection (port 5432, マイグレーション用) */
    DATABASE_URL: z.string().optional(),
    /** Supabase pgbouncer pooled connection (port 6543, アプリ用) */
    DATABASE_URL_POOLED: z.string().optional(),
  })
  .readonly();
