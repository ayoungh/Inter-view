"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CandidateSession } from "@/lib/candidate";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { FixWorkspace } from "@/components/FixWorkspace";

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/sessions/${id}`);
      if (cancelled) return;

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (res.ok) {
        setNotFound(false);
        setSession(await res.json());
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (notFound) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Session not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Double-check the link you were given, or ask your interviewer for a
          new one.
        </p>
      </Centered>
    );
  }
  if (!session) {
    return (
      <Centered>
        <p className="text-sm text-neutral-500">Loading interview…</p>
      </Centered>
    );
  }

  if (session.status === "review") {
    return (
      <ReviewWorkspace
        session={session}
        onPhaseChange={() => {
          setSession(null);
          setReloadKey((value) => value + 1);
        }}
      />
    );
  }
  if (session.status === "fixing") {
    return (
      <FixWorkspace
        session={session}
        onPhaseChange={() => {
          setSession(null);
          setReloadKey((value) => value + 1);
        }}
      />
    );
  }
  return (
    <Centered>
      <h1 className="text-2xl font-semibold">All done 🎉</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        Your review and fixes have been submitted. Your interviewer will walk
        through the results with you — thanks for taking part.
      </p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      {children}
    </main>
  );
}
