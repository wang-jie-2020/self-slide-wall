import { NextResponse } from "next/server";

import { RequestError } from "@/server/activity-service";

export function ok<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export function fail(error: unknown) {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "服务器处理失败。" }, { status: 500 });
}
