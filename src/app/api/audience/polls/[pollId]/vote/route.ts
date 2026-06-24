import { castVote } from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

type RoutePollContext = {
  params: Promise<{ pollId: string }>;
};

export async function POST(request: Request, context: RoutePollContext) {
  try {
    const body = (await request.json()) as {
      audienceSessionId?: string;
      pollOptionId?: string;
    };
    const { pollId } = await context.params;
    const result = await castVote({
      pollId,
      audienceSessionId: body.audienceSessionId ?? "",
      pollOptionId: body.pollOptionId ?? ""
    });
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
