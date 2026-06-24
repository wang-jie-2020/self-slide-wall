"use client";

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

type DisplayActivity = {
  id: string;
  title: string;
  accessCode: string;
  joinUrl: string;
  qrCodeDataUrl: string;
  questions: AudienceQuestion[];
};

type DisplayPollOption = {
  id: string;
  text: string;
  percentage: number;
};

type DisplayPoll = {
  id: string;
  prompt: string;
  sortOrder: number;
  isClosed: boolean;
  createdAt: string;
  totalVotes: number;
  options: DisplayPollOption[];
};

const fetcher = (url: string) => fetch(url).then((response) => response.json());

function PollBar({ percentage }: { percentage: number }) {
  return (
    <div className="h-3 w-full rounded-sm bg-stone-700">
      <div
        className="h-3 rounded-sm bg-emerald-400 transition-all"
        style={{ width: `${Math.max(percentage, 2)}%` }}
      />
    </div>
  );
}

export default function DisplayPage() {
  const params = useParams<{ accessCode: string }>();
  const accessCode = params.accessCode;
  const { data, isLoading } = useSWR<{ activity: DisplayActivity }>(
    accessCode ? `/api/display/activities/${accessCode}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  const { data: pollData } = useSWR<{ polls: DisplayPoll[] }>(
    accessCode ? `/api/display/activities/${accessCode}/polls` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  return (
    <main className="flex min-h-screen w-full bg-stone-950 px-6 py-8 text-white">
      {isLoading ? <p className="text-stone-300">正在加载展示视图...</p> : null}
      {data?.activity ? (
        <section className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="flex h-fit flex-col gap-6 rounded-md border border-stone-700 bg-stone-900 p-5">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-emerald-300">现场加入入口</p>
              <h1 className="text-3xl font-semibold">{data.activity.title}</h1>
              <div className="flex flex-col gap-2">
                <p className="text-lg text-stone-300">访问码</p>
                <p className="font-mono text-6xl font-bold tracking-widest text-emerald-200">
                  {data.activity.accessCode}
                </p>
              </div>
              <p className="break-all text-base text-stone-300">
                {data.activity.joinUrl}
              </p>
            </div>
            <div className="flex justify-center rounded-md bg-white p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="加入活动二维码"
                height={280}
                src={data.activity.qrCodeDataUrl}
                width={280}
              />
            </div>
          </aside>

          <div className="flex flex-col gap-6">
            {/* Polls section */}
            {(pollData?.polls ?? []).length > 0 ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-3xl font-semibold">投票结果</h2>
                <ul className="grid gap-4">
                  {pollData!.polls.map((poll) => (
                    <li
                      className="rounded-md border border-stone-700 bg-stone-900 p-5"
                      key={poll.id}
                    >
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-semibold">{poll.prompt}</h3>
                        {poll.isClosed ? (
                          <span className="rounded-sm bg-stone-700 px-2 py-0.5 text-xs font-medium text-stone-300">
                            已关闭
                          </span>
                        ) : (
                          <span className="rounded-sm bg-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-200">
                            进行中
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-stone-400">
                        总票数 {poll.totalVotes}
                      </p>
                      <ul className="mt-4 flex flex-col gap-3">
                        {poll.options.map((option) => (
                          <li className="flex flex-col gap-1" key={option.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-lg text-stone-200">
                                {option.text}
                              </span>
                              <span className="shrink-0 text-lg font-semibold text-emerald-300">
                                {option.percentage}%
                              </span>
                            </div>
                            <PollBar percentage={option.percentage} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-semibold">观众问题</h2>
              {data.activity.questions.length > 0 ? (
                <ul className="grid gap-4">
                  {data.activity.questions.map((question) => (
                    <li
                      className="rounded-md border border-stone-700 bg-stone-900 p-5"
                      key={question.id}
                    >
                      {question.isPinned ? (
                        <p className="mb-2 text-sm font-medium text-amber-300">
                          置顶
                        </p>
                      ) : null}
                      <p className="text-2xl leading-relaxed">{question.text}</p>
                      <p className="mt-3 flex items-center gap-4 text-base text-stone-400">
                        <span>{question.displayName ?? "匿名观众"}</span>
                        <span className="text-emerald-300">
                          ♥ {question.likeCount}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-stone-700 bg-stone-900 p-5 text-lg text-stone-300">
                  暂无观众问题。
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
