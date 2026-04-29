import { getSupabaseAdmin } from "../server/supabase-admin";
import { getDefaultPromptTemplate, getDefaultPromptTemplates } from "./default-prompts";
import type { AgentKey, PromptTemplate } from "./types";

export async function getPromptTemplate(agentKey: AgentKey): Promise<PromptTemplate> {
  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("prompt_templates")
    .select("agent_key,display_name,system_prompt")
    .eq("agent_key", agentKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return getDefaultPromptTemplate(agentKey);
  }
  return {
    agentKey: data.agent_key as AgentKey,
    displayName: data.display_name,
    systemPrompt: data.system_prompt,
  };
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("prompt_templates")
    .select("agent_key,display_name,system_prompt")
    .order("agent_key", { ascending: true });
  if (!data || data.length === 0) {
    return getDefaultPromptTemplates();
  }
  return data.map((row: any) => ({
    agentKey: row.agent_key as AgentKey,
    displayName: row.display_name,
    systemPrompt: row.system_prompt,
  }));
}

export async function upsertPromptTemplate(params: {
  agentKey: AgentKey;
  displayName: string;
  systemPrompt: string;
  updatedBy: string;
}) {
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase.from("prompt_templates").upsert(
    {
      agent_key: params.agentKey,
      display_name: params.displayName,
      system_prompt: params.systemPrompt,
      updated_by: params.updatedBy,
      is_active: true,
    },
    {
      onConflict: "agent_key",
    },
  );
  if (error) throw new Error(error.message);
}
