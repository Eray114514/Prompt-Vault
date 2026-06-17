export type Category =
  | "image_generation"
  | "image_editing"
  | "video_generation"
  | "llm_chat";

export type FilterKey = "all" | "favorites" | Category;

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: Category;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewPrompt {
  title: string;
  content: string;
  category: Category;
  tags: string[];
}

export interface CategoryInfo {
  value: FilterKey;
  label: string;
  icon: string;
}

// 分类选项（用于新建/编辑时选择，value 仅为四大分类）
export interface CategoryOption {
  value: Category;
  label: string;
  icon: string;
}

// 侧边栏导航项：全部 + 收藏 + 四个分类
export const NAV_ITEMS: CategoryInfo[] = [
  { value: "all", label: "全部", icon: "all" },
  { value: "favorites", label: "收藏", icon: "star" },
  { value: "image_generation", label: "图片生成", icon: "image" },
  { value: "image_editing", label: "图片编辑", icon: "edit" },
  { value: "video_generation", label: "视频生成", icon: "video" },
  { value: "llm_chat", label: "AI 对话", icon: "chat" },
];

// 仅四个分类（用于新建时选择）
export const CATEGORIES: CategoryOption[] = [
  { value: "image_generation", label: "图片生成", icon: "image" },
  { value: "image_editing", label: "图片编辑", icon: "edit" },
  { value: "video_generation", label: "视频生成", icon: "video" },
  { value: "llm_chat", label: "AI 对话", icon: "chat" },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  image_generation: "图片生成",
  image_editing: "图片编辑",
  video_generation: "视频生成",
  llm_chat: "AI 对话",
};

// 分类霓虹色
export const CATEGORY_COLORS: Record<Category, string> = {
  image_generation: "#ff6b35",
  image_editing: "#00d9ff",
  video_generation: "#ff006e",
  llm_chat: "#caff00",
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLORS[category];
}
