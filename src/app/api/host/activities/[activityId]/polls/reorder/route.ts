import {
  reorderPolls,
  resolveActivityId,
  type RouteHostActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../../../respond";

export async function POST(
  request: Request,
  context: RouteHostActivityContext
) {
  try {
    const body = (await request.json()) as {
      pollIds?: string[];
    };
    const result = await reorderPolls({
      activityId: await resolveActivityId(context),
      pollIds: body.pollIds ?? []
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
