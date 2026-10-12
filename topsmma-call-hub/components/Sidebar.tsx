"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SidebarProps = {
  fullName: string;
  dueCount: number;
  totalLeads: number;
};

const navLinks: { label: string; href: string }[] = [
  { label: "Call queue", href: "/call-queue" },
  { label: "Team & pool", href: "/team-pool" },
];

const comingSoon = ["Inbox", "Tasks", "Pipeline", "Reports", "Emails", "Scripts", "Playbook"];

export default function Sidebar({ fullName, dueCount, totalLeads }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex-none w-[258px] min-w-[258px] bg-panel border-r border-line p-3.5 flex flex-col gap-0.5">
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-4">
        <div className="w-[34px] h-[34px] rounded-lg bg-card flex items-center justify-center font-extrabold text-sm text-accentlight">
          TS
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">Call Hub</div>
          <div className="text-[11px] text-muted">TOPSMMA</div>
        </div>
      </div>

      <div className="px-0.5 pb-4">
        <div className="bg-cardhover border border-line rounded-lg px-2.5 py-2">
          <div className="text-[10px] text-muted uppercase tracking-wide">Workspace</div>
          <div className="text-xs font-bold mt-0.5">UK clinics</div>
        </div>
      </div>

      <div className="flex flex-col gap-px py-1">
        {navLinks.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] ${
                active ? "bg-cardhover font-semibold" : "text-[#AEB6C2] hover:bg-cardhover/60"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/call-queue" && dueCount > 0 && (
                <span className="bg-bad/15 text-bad text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                  {dueCount} due
                </span>
              )}
              {item.href === "/team-pool" && (
                <span className="text-[11px] text-dim">{totalLeads}</span>
              )}
            </Link>
          );
        })}
        {comingSoon.map((label) => (
          <div key={label} className="px-2.5 py-2 rounded-lg text-[13px] text-[#AEB6C2]/50">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3.5 border-t border-line flex flex-col gap-2.5">
        <div className="flex items-center gap-2 px-2.5">
          <div className="relative">
            <div className="w-[26px] h-[26px] rounded-full bg-card flex items-center justify-center text-[11px] font-bold">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full bg-good border-2 border-panel" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{fullName}</div>
            <div className="text-[10.5px] text-good">Online</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-left px-2.5 py-2 rounded-lg text-[12.5px] text-dim hover:text-ink hover:bg-cardhover/60"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
