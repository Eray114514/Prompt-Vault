import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. 请创建 .env.local 并填入 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * 这个客户端只在服务端被使用 —— Server Action（Node）和 /api/prompts（Edge）。
 * 浏览器包里没有 Supabase 域名也没有任何密钥（已实测校验过），
 * 所以下面的 key 可以当作服务端凭据看待。
 *
 * 更稳妥的做法是在 Vercel 上再配一个 SUPABASE_SERVICE_ROLE_KEY：
 * 它同样只在服务端使用，配合"开启 RLS 且不写任何策略"，即使 anon key 将来外泄也读不到数据。
 * 没配置时回退到 anon key，保持开箱可用。
 */
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export const supabase = createClient(supabaseUrl, serverKey);
