import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/profile-settings";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Perfil · Antídoto" };

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col gap-5 pt-11">
      <header className="flex flex-col gap-0.5 px-5">
        <h1 className="text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
          Perfil
        </h1>
        <p className="text-[15px] tracking-[-0.01em] text-label-2">{user.email}</p>
      </header>

      <ProfileSettings profile={profile} />
    </div>
  );
}
