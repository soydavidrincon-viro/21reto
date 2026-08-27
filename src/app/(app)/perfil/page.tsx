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
    <div className="flex flex-col gap-4 pt-11 lg:pt-0">
      <header className="entrar flex flex-col gap-0.5 px-5 lg:px-0">
        <span className="truncate text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3">
          {user.email}
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-label lg:text-[30px]">
          Perfil
        </h1>
      </header>

      <ProfileSettings profile={profile} />
    </div>
  );
}
