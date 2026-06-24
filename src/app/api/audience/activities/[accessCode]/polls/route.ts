import {
  listAudiencePolls,
  resolveAccessCode,
  type RouteActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

export async function GET(request: Request, context: RouteActivityContext) {
  try {
    const { searchParams } = new URL(request.url);
    const audienceSessionId = searchParams.get("audienceSessionId") ?? "";
    const polls = await listAudiencePolls(
      await resolveAccessCode(context),
      audienceSessionId
    );
    return ok({ polls });
  } catch (error) {
    return fail(error);
  }
}
