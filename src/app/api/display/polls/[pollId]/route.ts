import { closePoll, RequestError } from "@/server/activity-service";
import { fail, ok } from "../../../respond";

type RoutePollContext = {
  params: Promise<{ pollId: string }>;
};

async function resolvePollId(context: RoutePollContext): Promise<string> {
  const params = await context.params;
  return params.pollId;
}

export async function PATCH(request: Request, context: RoutePollContext) {
  try {
    const body = (await request.json()) as {
      action?: string;
    };

    const pollId = await resolvePollId(context);

    if (body.action === "close") {
      return ok(await closePoll(pollId));
    }

    throw new RequestError("不支持的投票操作。", 400);
  } catch (error) {
    return fail(error);
  }
}
