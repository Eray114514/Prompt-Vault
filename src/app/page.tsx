import { getPrompts } from "@/lib/actions";
import { PromptVault } from "@/components/PromptVault";

export const dynamic = "force-dynamic";

export default async function Home() {
  const prompts = await getPrompts();
  return <PromptVault initialPrompts={prompts} />;
}
