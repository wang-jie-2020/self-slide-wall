import { toggleQuestionLike } from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

type RouteAudienceQuestionContext = {
  params: Promise<{ questionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteAudienceQuestionContext
) {
  try {
    const body = (await request.json()) as {
      audienceSessionId?: string;
    };
    const { questionId } = await context.params;
    const result = await toggleQuestionLike({
      questionId,
      audienceSessionId: body.audienceSessionId ?? ""
    });

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
