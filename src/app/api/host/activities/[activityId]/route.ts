import {
  endActivity,
  RequestError,
  resolveActivityId,
  softDeleteActivity,
  startActivity,
  type RouteHostActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../respond";

export async function PATCH(request: Request, context: RouteHostActivityContext) {
  try {
    const body = (await request.json()) as {
      action?: string;
    };
    const activityId = await resolveActivityId(context);
    const activity =
      body.action === "start"
        ? await startActivity(activityId)
        : body.action === "end"
          ? await endActivity(activityId)
          : null;

    if (!activity) {
      throw new RequestError("不支持的活动生命周期操作。", 400);
    }

    return ok({ activity });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteHostActivityContext
) {
  try {
    const activity = await softDeleteActivity(await resolveActivityId(context));

    return ok({ activity });
  } catch (error) {
    return fail(error);
  }
}
