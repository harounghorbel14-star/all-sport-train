"use client";

import { useEffect, useState } from "react";
import { CloudDownload, CloudOff } from "lucide-react";
import { isSaved, removeOffline, saveForOffline, swSupported, type SavedItem } from "@/lib/client/pwa";
import { useToast } from "../ui/overlay";
import { Button } from "../ui/primitives";

/** Saves the current lesson/plan page so it opens without a connection. */
export function SaveOffline({ url, title, kind }: { url: string; title: string; kind: SavedItem["kind"] }) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ok = swSupported() && process.env.NODE_ENV === "production";
    setSupported(ok);
    if (ok) isSaved(url).then(setSaved).catch(() => undefined);
  }, [url]);
  if (!supported) return null;
  async function toggle() {
    setBusy(true);
    try {
      if (saved) {
        await removeOffline(url);
        setSaved(false);
        toast("Removed from offline");
      } else {
        await saveForOffline({ url, title, kind });
        setSaved(true);
        toast("Saved — available offline on this device");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save for offline", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={toggle} loading={busy} icon={saved ? <CloudOff className="size-4" /> : <CloudDownload className="size-4" />}>
      {saved ? "Saved offline · remove" : "Save for offline"}
    </Button>
  );
}
