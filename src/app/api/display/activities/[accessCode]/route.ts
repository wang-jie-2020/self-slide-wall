import {
  getDisplayActivity,
  resolveAccessCode,
  type RouteActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../respond";

export async function GET(request: Request, context: RouteActivityContext) {
  try {
    const origin = new URL(request.url).origin;
    const activity = await getDisplayActivity(
      await resolveAccessCode(context),
      origin
    );

    return ok({ activity });
  } catch (error) {
    return fail(error);
  }
}
