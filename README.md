<div align="center">

# 🗝️ Prompt Vault

**A personal prompt management tool with multi-device sync.**

中文说明见下方。

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📸 Screenshots

> Replace the placeholder below with your own screenshot.

![Prompt Vault Screenshot](screenshots/placeholder.png)

*Main interface: dark theme with neon index-card style prompt cards.*

---

## ✨ Features

- **Category Management** — Organize prompts into four categories:
  - 🎨 Image Generation (`image_generation`)
  - ✏️ Image Editing (`image_editing`)
  - 🎬 Video Generation (`video_generation`)
  - 💬 LLM Chat (`llm_chat`)
- **CRUD Operations** — Create, read, update, and delete prompts.
- **Notes** — Add usage notes or image-specific remarks to each prompt.
- **One-Click Copy** — Copy prompt content to your clipboard instantly.
- **Clipboard Detection** — Automatically detects clipboard text and suggests adding a new prompt.
- **Full-Text Search** — Search across titles, content, notes, and tags.
- **Favorites Filter** — Quickly view and manage your favorite prompts.
- **Dark Theme + Neon Index Cards** — Distinctive neon index-card visual style with category-based accent colors.
- **Multi-Device Sync** — Powered by Supabase, so your prompts stay in sync across devices.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 3.4](https://tailwindcss.com/) |
| Database | [Supabase](https://supabase.com/) |
| Runtime | Node.js 18+ |

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone git@github.com:your-username/prompt-vault.git
cd prompt-vault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> Get these values from your Supabase dashboard: **Project Settings → API**.

### 4. Set up the database

Create a `prompts` table in Supabase (see [Database Schema](#database-schema) below).

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous/public API key |

> These variables are required at build time because the Supabase client runs in the browser.

---

## 🗄️ Database Schema

Create the following table in your Supabase project (e.g., via the **Table Editor** or **SQL Editor**):

```sql
create table prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  notes text not null default '',
  category text not null check (category in ('image_generation', 'image_editing', 'video_generation', 'llm_chat')),
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) if you plan to support authentication later.
alter table prompts enable row level security;
```

If you already created the table before notes were added, run:

```sql
alter table prompts
add column if not exists notes text not null default '';
```

### Category Colors

| Category | Neon Accent |
|----------|-------------|
| `image_generation` | `#ff6b35` |
| `image_editing` | `#00d9ff` |
| `video_generation` | `#ff006e` |
| `llm_chat` | `#caff00` |

---

## 📁 Project Structure

```
prompt-vault/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components (cards, modals, sidebar, etc.)
│   └── lib/                 # Utilities: Supabase client, server actions, types
├── .env.local.example       # Example environment variables
├── next.config.mjs          # Next.js configuration
├── package.json             # Project dependencies and scripts
├── tailwind.config.ts       # Tailwind CSS configuration
└── README.md                # This file
```

---

## 🌐 Deployment

Prompt Vault is a standard Next.js application and can be deployed to any platform that supports Next.js:

- **[Vercel](https://vercel.com/)** (recommended)
- **[Netlify](https://www.netlify.com/)**
- **Self-hosted server** with Node.js

### Vercel

1. Push your code to GitHub.
2. Import the repository on [Vercel](https://vercel.com/).
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the project settings.
4. Deploy.

### Build

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🌟 中文说明

**Prompt Vault** 是一款个人提示词管理工具，基于 **Next.js 14 + TypeScript + Tailwind CSS + Supabase** 构建，支持多端同步。

### 主要功能

- 按四大分类管理提示词：图片生成、图片编辑、视频生成、AI 对话
- 新建 / 编辑 / 删除提示词
- 为提示词添加备注
- 一键复制提示词内容
- 剪贴板检测，自动提示添加
- 全文搜索（标题、内容、备注、标签）
- 收藏筛选
- 深色主题 + 霓虹索引卡视觉风格

### 快速开始

```bash
git clone git@github.com:your-username/prompt-vault.git
cd prompt-vault
npm install
cp .env.local.example .env.local
# 在 .env.local 中填入 Supabase 配置
npm run dev
```

然后在浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

| 变量名 | 是否必填 | 说明 |
|--------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase 匿名/公开 API 密钥 |

### 数据库表

参考上文 **Database Schema** 在 Supabase 中创建 `prompts` 表即可运行。
