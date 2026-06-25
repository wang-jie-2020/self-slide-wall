import {
  hideQuestion,
  markQuestionAnswered,
  pinQuestion,
  RequestError,
  restoreQuestion,
  unpinQuestion,
} from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

type RouteQuestionContext = {
  params: Promise<{ questionId: string }>;
};

async function resolveQuestionId(context: RouteQuestionContext): Promise<string> {
  const params = await context.params;
  return params.questionId;
}

export async function POST(request: Request, context: RouteQuestionContext) {
  try {
    const body = (await request.json()) as {
      action?: string;
    };
    const questionId = await resolveQuestionId(context);

    switch (body.action) {
      case "pin":
        return ok(await pinQuestion(questionId));
      case "unpin":
        return ok(await unpinQuestion(questionId));
      case "answer":
        return ok(await markQuestionAnswered(questionId));
      case "restore":
        return ok(await restoreQuestion(questionId));
      case "hide":
        return ok(await hideQuestion(questionId));
      default:
        throw new RequestError("不支持的控场操作。", 400);
    }
  } catch (error) {
    return fail(error);
  }
}
