"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";

type DisplayActivity = {
  id: string;
  title: string;
  accessCode: string;
  joinUrl: string;
  qrCodeDataUrl: string;
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
    <main className="flex min-h-screen w-full items-center justify-center bg-stone-950 px-6 py-8 text-white">
      {isLoading ? <p className="text-stone-300">正在加载展示视图...</p> : null}
      {data?.activity ? (
        <section className="grid w-full max-w-6xl items-center gap-10 md:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium text-emerald-300">现场加入入口</p>
            <h1 className="text-4xl font-semibold">{data.activity.title}</h1>
            <div className="flex flex-col gap-2">
              <p className="text-lg text-stone-300">访问码</p>
              <p className="font-mono text-6xl font-bold tracking-widest text-emerald-200">
                {data.activity.accessCode}
              </p>
            </div>
            <p className="break-all text-lg text-stone-300">{data.activity.joinUrl}</p>
          </div>
          <div className="flex justify-center rounded-md bg-white p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="加入活动二维码" height={280} src={data.activity.qrCodeDataUrl} width={280} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
