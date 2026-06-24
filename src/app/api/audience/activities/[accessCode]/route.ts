import {
  getAudienceActivity,
  resolveAccessCode,
  type RouteActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../respond";

export async function GET(_request: Request, context: RouteActivityContext) {
  try {
    const activity = await getAudienceActivity(await resolveAccessCode(context));

    return ok({ activity });
  } catch (error) {
    return fail(error);
  }
}
