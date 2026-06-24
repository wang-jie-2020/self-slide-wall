import { createDraftActivity, listOwnedActivities } from "@/server/activity-service";
import { fail, ok } from "../../respond";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      ownerId?: string;
    };
    const activity = await createDraftActivity({
      title: body.title ?? "",
      ownerId: body.ownerId
    });

    return ok({ activity }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activities = await listOwnedActivities(searchParams.get("ownerId") ?? undefined);

    return ok({ activities });
  } catch (error) {
    return fail(error);
  }
}
