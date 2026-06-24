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
  likeCount: number;
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

type AudiencePollOption = {
  id: string;
  text: string;
};

type AudiencePoll = {
  id: string;
  prompt: string;
  sortOrder: number;
  isClosed: boolean;
  createdAt: string;
  options: AudiencePollOption[];
  myOptionId: string | null;
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
  const [likingQuestionId, setLikingQuestionId] = useState<string | null>(null);
  const [likedQuestions, setLikedQuestions] = useState<Set<string>>(new Set());

  // Optimistic poll state
  const [optimisticPolls, setOptimisticPolls] = useState<Record<string, string | null>>({});
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<{ activity: AudienceActivity }>(
    accessCode ? `/api/audience/activities/${accessCode}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  // Polls SWR
  const { data: pollData, mutate: mutatePolls } = useSWR<{ polls: AudiencePoll[] }>(
    accessCode && audienceSessionId
      ? `/api/audience/activities/${accessCode}/polls?audienceSessionId=${audienceSessionId}`
      : null,
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

  async function likeQuestion(questionId: string) {
    if (!audienceSessionId) return;
    setLikingQuestionId(questionId);
    setError(null);

    const response = await fetch(`/api/audience/questions/${questionId}/like`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audienceSessionId })
    });
    const body = (await response.json()) as { error?: string; liked?: boolean };

    if (!response.ok) {
      if (response.status === 409) {
        setError(body.error ?? "已经点过赞了。");
      } else {
        setError(body.error ?? "点赞失败。");
      }
    } else {
      setLikedQuestions((prev) => new Set(prev).add(questionId));
      await mutate();
    }

    setLikingQuestionId(null);
  }

  async function castVote(pollId: string, optionId: string) {
    if (!audienceSessionId) return;
    setError(null);
    setVotingPollId(pollId);

    // Optimistic update
    setOptimisticPolls((prev) => ({ ...prev, [pollId]: optionId }));
    void mutatePolls();

    const response = await fetch(`/api/audience/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audienceSessionId, pollOptionId: optionId })
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setOptimisticPolls((prev) => {
        const next = { ...prev };
        delete next[pollId];
        return next;
      });
      void mutatePolls();
      setError(body.error ?? "投票失败。");
    } else {
      await mutatePolls();
    }

    setVotingPollId(null);
  }

  // Merge optimistic poll state with server data
  const polls = (pollData?.polls ?? []).map((poll) => {
    const optimistic = optimisticPolls[poll.id];
    if (optimistic !== undefined) {
      return { ...poll, myOptionId: optimistic };
    }
    return poll;
  });

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

          {/* Polls section */}
          {audienceSessionId && polls.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-stone-950">进行中投票</h2>
              <ul className="flex flex-col gap-3">
                {polls.map((poll) => (
                  <li
                    className="rounded-md border border-stone-300 bg-white p-5 shadow-sm"
                    key={poll.id}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-stone-900">
                        {poll.prompt}
                      </h3>
                      {poll.isClosed ? (
                        <span className="rounded-sm bg-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-600">
                          已关闭
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {poll.options.map((option) => {
                        const isSelected = poll.myOptionId === option.id;
                        const canVote =
                          !poll.isClosed &&
                          data.activity.acceptsInteraction &&
                          audienceSessionId;

                        return (
                          <li key={option.id}>
                            <button
                              className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                  : poll.isClosed
                                    ? "border-stone-200 bg-stone-50 text-stone-500"
                                    : canVote
                                      ? "border-stone-200 hover:border-emerald-300 hover:bg-emerald-50"
                                      : "border-stone-200 bg-stone-50 text-stone-400"
                              }`}
                              disabled={
                                !canVote || votingPollId === poll.id
                              }
                              onClick={() => void castVote(poll.id, option.id)}
                              type="button"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                  isSelected
                                    ? "border-emerald-600 bg-emerald-600"
                                    : "border-stone-300"
                                }`}
                              >
                                {isSelected ? (
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                ) : null}
                              </span>
                              <span>{option.text}</span>
                              {isSelected && poll.isClosed ? (
                                <span className="ml-auto text-xs text-stone-500">
                                  你的选择
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-stone-950">观众问题</h2>
            {data.activity.questions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {data.activity.questions.map((question) => {
                  const alreadyLiked = likedQuestions.has(question.id);
                  const canLike =
                    data.activity.acceptsInteraction &&
                    audienceSessionId &&
                    !alreadyLiked;

                  return (
                    <li
                      className="rounded-md border border-stone-300 bg-white p-4 shadow-sm"
                      key={question.id}
                    >
                      {question.isPinned ? (
                        <p className="mb-1 text-xs font-medium text-amber-700">
                          置顶
                        </p>
                      ) : null}
                      <p className="text-stone-950">{question.text}</p>
                      <div className="mt-2 flex items-center gap-3 text-sm text-stone-500">
                        <span>
                          {question.displayName ?? "匿名观众"} ·{" "}
                          {new Date(question.createdAt).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <button
                            className={
                              alreadyLiked
                                ? "text-emerald-700"
                                : canLike
                                  ? "text-stone-400 hover:text-emerald-700"
                                  : "text-stone-300"
                            }
                            disabled={!canLike || likingQuestionId === question.id}
                            onClick={() => void likeQuestion(question.id)}
                            title={alreadyLiked ? "已点赞" : "点赞"}
                            type="button"
                          >
                            {likingQuestionId === question.id
                              ? "点赞中..."
                              : alreadyLiked
                                ? "♥"
                                : "♡"}
                          </button>
                          <span>{question.likeCount}</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
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
