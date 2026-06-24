import {
  resolveAccessCode,
  submitAudienceQuestion,
  type RouteActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

export async function POST(request: Request, context: RouteActivityContext) {
  try {
    const body = (await request.json()) as {
      audienceSessionId?: string;
      text?: string;
    };
    const question = await submitAudienceQuestion({
      accessCode: await resolveAccessCode(context),
      audienceSessionId: body.audienceSessionId ?? "",
      text: body.text ?? ""
    });

    return ok({ question }, 201);
  } catch (error) {
    return fail(error);
  }
}
