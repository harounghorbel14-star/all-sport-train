"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export function FavoriteButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const toast = useToast();
  return (
    <Button
      variant={on ? "primary" : "outline"}
      aria-pressed={on}
      icon={<Heart className={on ? "size-4 fill-current" : "size-4"} />}
      onClick={async () => {
        setOn(!on);
        try {
          await api(`/api/exercises/${slug}/favorite`, { body: { favorite: !on } });
        } catch (e) {
          setOn(on);
          toast(e instanceof Error ? e.message : "Could not update", "error");
        }
      }}
    >
      {on ? "Favorited" : "Favorite"}
    </Button>
  );
}
