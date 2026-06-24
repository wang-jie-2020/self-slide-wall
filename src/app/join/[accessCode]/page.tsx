"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";

type AudienceActivity = {
  id: string;
  title: string;
  accessCode: string;
  state: "DRAFT" | "LIVE" | "ENDED";
  acceptsInteraction: boolean;
  audienceNotice: string;
};

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function JoinPage() {
  const params = useParams<{ accessCode: string }>();
  const accessCode = params.accessCode;
  const [displayName, setDisplayName] = useState("");
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useSWR<{ activity: AudienceActivity }>(
    accessCode ? `/api/audience/activities/${accessCode}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/audience/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode, displayName })
    });

    const body = (await response.json()) as {
      error?: string;
      audienceSession?: { displayName: string | null };
    };
    if (!response.ok || !body.audienceSession) {
      setError(body.error ?? "加入失败。");
      return;
    }

    setSessionName(body.audienceSession.displayName ?? "匿名观众");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-8">
      {isLoading ? <p className="text-sm text-stone-600">正在加载活动...</p> : null}
      {data?.activity ? (
        <>
          <header className="flex flex-col gap-3 border-b border-stone-300 pb-5">
            <p className="text-sm font-medium text-emerald-800">
              观众视图 · 访问码 {data.activity.accessCode}
            </p>
            <h1 className="text-2xl font-semibold text-stone-950">
              {data.activity.title}
            </h1>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {data.activity.audienceNotice}
            </p>
          </header>

          <form
            className="flex flex-col gap-4 rounded-md border border-stone-300 bg-white p-5 shadow-sm"
            onSubmit={join}
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-stone-800">
              显示名
              <input
                className="rounded-md border border-stone-300 px-3 py-2 text-base outline-none focus:border-emerald-700"
                maxLength={40}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="可留空匿名加入"
                value={displayName}
              />
            </label>
            <p className="text-sm text-stone-600">显示名不会被验证身份。</p>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white"
              type="submit"
            >
              加入活动
            </button>
            {sessionName ? (
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                已以 {sessionName} 加入。
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </main>
  );
}
