import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "superadmin" | "coordinator" | "leader";

export type SessionInfo = {
  userId: string;
  email: string | null;
  name: string;
  role: AppRole | null;
  campaign: {
    id: string;
    name: string;
    candidate_name: string | null;
    instagram_username: string | null;
    is_demo: boolean;
  } | null;
  leaderId: string | null;
  leaderName: string | null;
};

export async function loadSession(): Promise<SessionInfo | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  await supabase.rpc("ensure_profile", {
    _name: (user.user_metadata?.["name"] as string | undefined) ?? "",
  });

  const [{ data: profile }, { data: roles }, { data: leader }] = await Promise.all([
    supabase.from("profiles").select("name, email, campaign_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("leaders").select("id, name").eq("user_id", user.id).maybeSingle(),
  ]);

  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  const role: AppRole | null = roleList.includes("superadmin")
    ? "superadmin"
    : roleList.includes("coordinator")
      ? "coordinator"
      : roleList.includes("leader")
        ? "leader"
        : null;

  let campaign: SessionInfo["campaign"] = null;
  if (profile?.campaign_id) {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, candidate_name, instagram_username, is_demo")
      .eq("id", profile.campaign_id)
      .maybeSingle();
    campaign = data ?? null;
  }

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    name: profile?.name || user.email?.split("@")[0] || "Usuário",
    role,
    campaign,
    leaderId: leader?.id ?? null,
    leaderName: leader?.name ?? null,
  };
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: loadSession,
    staleTime: 30_000,
  });
}

export function isCoordinator(session: SessionInfo | null | undefined): boolean {
  return session?.role === "coordinator" || session?.role === "superadmin";
}
