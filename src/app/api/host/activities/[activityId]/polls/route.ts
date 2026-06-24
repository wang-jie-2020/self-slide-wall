import {
  createPoll,
  listHostPolls,
  resolveActivityId,
  type RouteHostActivityContext
} from "@/server/activity-service";
import { fail, ok } from "../../../../respond";

export async function GET(
  _request: Request,
  context: RouteHostActivityContext
) {
  try {
    const polls = await listHostPolls(await resolveActivityId(context));
    return ok({ polls });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: Request,
  context: RouteHostActivityContext
) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      options?: { text: string }[];
    };
    const poll = await createPoll({
      activityId: await resolveActivityId(context),
      prompt: body.prompt ?? "",
      options: body.options ?? []
    });
    return ok({ poll }, 201);
  } catch (error) {
    return fail(error);
  }
}
