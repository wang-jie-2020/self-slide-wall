import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-emerald-800">观众提问墙 MVP</p>
        <h1 className="text-3xl font-semibold text-stone-950">活动创建与最小加入路径</h1>
        <p className="max-w-2xl text-base leading-7 text-stone-700">
          当前切片支持主持账号创建草稿活动，观众通过访问码加入，展示视图公开加入信息和二维码。
        </p>
      </header>
      <nav className="flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white"
          href="/host"
        >
          进入主持控制台
        </Link>
      </nav>
    </main>
  );
}
