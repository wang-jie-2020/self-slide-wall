import {
  closePoll,
  deletePoll,
  RequestError,
  updatePoll
} from "@/server/activity-service";
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
      prompt?: string;
      options?: { text: string }[];
    };

    const pollId = await resolvePollId(context);

    if (body.action === "close") {
      return ok(await closePoll(pollId));
    }

    // Edit poll (prompt/options)
    if (body.prompt !== undefined || body.options !== undefined) {
      return ok(await updatePoll({ pollId, prompt: body.prompt, options: body.options }));
    }

    throw new RequestError("不支持的投票操作。", 400);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RoutePollContext
) {
  try {
    const result = await deletePoll(await resolvePollId(context));
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
