import {
  listDisplayPolls,
  resolveAccessCode,
  type RouteActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

export async function GET(_request: Request, context: RouteActivityContext) {
  try {
    const polls = await listDisplayPolls(await resolveAccessCode(context));
    return ok({ polls });
  } catch (error) {
    return fail(error);
  }
}
