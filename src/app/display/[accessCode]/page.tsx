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

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function DisplayPage() {
  const params = useParams<{ accessCode: string }>();
  const accessCode = params.accessCode;
  const { data, isLoading } = useSWR<{ activity: DisplayActivity }>(
    accessCode ? `/api/display/activities/${accessCode}` : null,
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
        </section>
      ) : null}
    </main>
  );
}
