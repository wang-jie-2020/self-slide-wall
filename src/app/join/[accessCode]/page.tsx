"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";

type AudienceQuestion = {
  id: string;
  text: string;
  displayName: string | null;
  createdAt: string;
  isPinned: boolean;
};

type AudienceActivity = {
  id: string;
  title: string;
  accessCode: string;
  state: "DRAFT" | "LIVE" | "ENDED";
  acceptsInteraction: boolean;
  audienceNotice: string;
  questionCharLimit: number;
  questions: AudienceQuestion[];
};

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function JoinPage() {
  const params = useParams<{ accessCode: string }>();
  const accessCode = params.accessCode;
  const [displayName, setDisplayName] = useState("");
  const [audienceSessionId, setAudienceSessionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionFeedback, setQuestionFeedback] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, mutate } = useSWR<{ activity: AudienceActivity }>(
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
      audienceSession?: { id: string; displayName: string | null };
    };
    if (!response.ok || !body.audienceSession) {
      setError(body.error ?? "加入失败。");
      return;
    }

    setAudienceSessionId(body.audienceSession.id);
    setSessionName(body.audienceSession.displayName ?? "匿名观众");
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionFeedback(null);
    setError(null);

    const response = await fetch(`/api/audience/activities/${accessCode}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audienceSessionId, text: questionText })
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(body.error ?? "提交观众问题失败。");
      return;
    }

    setQuestionText("");
    setQuestionFeedback("观众问题已提交。");
    await mutate();
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

          <form
            className="flex flex-col gap-4 rounded-md border border-stone-300 bg-white p-5 shadow-sm"
            onSubmit={submitQuestion}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">提交观众问题</h2>
              <p className="text-sm text-stone-500">
                {questionText.length}/{data.activity.questionCharLimit}
              </p>
            </div>
            <textarea
              className="min-h-28 resize-y rounded-md border border-stone-300 px-3 py-2 text-base outline-none focus:border-emerald-700"
              disabled={!data.activity.acceptsInteraction || !audienceSessionId}
              maxLength={data.activity.questionCharLimit}
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="输入你想提的问题"
              value={questionText}
            />
            <button
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-stone-400"
              disabled={
                !data.activity.acceptsInteraction ||
                !audienceSessionId ||
                !questionText.trim()
              }
              type="submit"
            >
              提交问题
            </button>
            {questionFeedback ? (
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {questionFeedback}
              </p>
            ) : null}
          </form>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-stone-950">观众问题</h2>
            {data.activity.questions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {data.activity.questions.map((question) => (
                  <li
                    className="rounded-md border border-stone-300 bg-white p-4 shadow-sm"
                    key={question.id}
                  >
                    <p className="text-stone-950">{question.text}</p>
                    <p className="mt-2 text-sm text-stone-500">
                      {question.displayName ?? "匿名观众"} ·{" "}
                      {new Date(question.createdAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-stone-300 bg-white p-4 text-sm text-stone-600">
                暂无观众问题。
              </p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
