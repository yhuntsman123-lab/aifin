import { NextRequest } from "next/server";
import { getSupabaseAnonServer } from "./supabase-anon";
import { getSupabaseAdmin } from "./supabase-admin";

export interface RequestUser {
  id: string;
  email?: string;
}

function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  const supabase = getSupabaseAnonServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email || undefined,
  };
}

export async function requireRequestUser(request: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(request);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error || !data) return false;
  return data.role === "admin";
}

