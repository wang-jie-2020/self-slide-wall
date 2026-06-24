"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import useSWR from "swr";

type Activity = {
  id: string;
  title: string;
  accessCode: string;
  state: "DRAFT" | "LIVE" | "ENDED";
  createdAt: string;
  questionCharLimit: number;
};

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function HostPage() {
  const [title, setTitle] = useState("TypeScript 现场问答");
  const [error, setError] = useState<string | null>(null);
  const { data, mutate, isLoading } = useSWR<{ activities: Activity[] }>(
    "/api/host/activities?ownerId=demo-host",
    fetcher,
    { refreshInterval: 2000 }
  );

  async function createActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/host/activities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, ownerId: "demo-host" })
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "创建失败。");
      return;
    }

    setTitle("");
    await mutate();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2 border-b border-stone-300 pb-5">
        <p className="text-sm font-medium text-emerald-800">主持控制台</p>
        <h1 className="text-2xl font-semibold text-stone-950">示例主持账号</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form
          className="flex h-fit flex-col gap-4 rounded-md border border-stone-300 bg-white p-5 shadow-sm"
          onSubmit={createActivity}
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-800">
            活动标题
            <input
              className="rounded-md border border-stone-300 px-3 py-2 text-base outline-none focus:border-emerald-700"
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="输入活动标题"
              value={title}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:bg-stone-400"
            disabled={!title.trim()}
            type="submit"
          >
            创建草稿活动
          </button>
        </form>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-stone-950">我的活动</h2>
          {isLoading ? <p className="text-sm text-stone-600">正在加载活动...</p> : null}
          <div className="grid gap-3">
            {(data?.activities ?? []).map((activity) => (
              <article
                className="rounded-md border border-stone-300 bg-white p-5 shadow-sm"
                key={activity.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-stone-950">
                      {activity.title}
                    </h3>
                    <p className="text-sm text-stone-600">
                      草稿活动 · 访问码 {activity.accessCode} · 问题字数限制{" "}
                      {activity.questionCharLimit}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
                      href={`/join/${activity.accessCode}`}
                    >
                      观众视图
                    </Link>
                    <Link
                      className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
                      href={`/display/${activity.accessCode}`}
                    >
                      展示视图
                    </Link>
                  </div>
                </div>
              </article>
            ))}
            {!isLoading && (data?.activities ?? []).length === 0 ? (
              <p className="rounded-md border border-stone-300 bg-white p-5 text-sm text-stone-600">
                还没有活动。
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
