"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { deleteCampaign } from "@/app/(app)/campaigns/actions";

export default function CampaignActions({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this campaign? Analytics and assignments will be removed.")) return;
    setDeleting(true);
    const res = await deleteCampaign(id);
    setDeleting(false);
    if (res.error) return toast(res.error, "error");
    toast("Campaign deleted", "success");
    router.push("/campaigns");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/campaigns/${id}/edit`}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 transition-colors"
      >
        <Pencil size={15} /> Edit
      </Link>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
      >
        {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        Delete
      </button>
    </div>
  );
}
