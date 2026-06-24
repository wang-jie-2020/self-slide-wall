import { createAudienceSession } from "@/server/activity-service";
import { fail, ok } from "../../respond";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accessCode?: string;
      displayName?: string | null;
    };
    const audienceSession = await createAudienceSession({
      accessCode: body.accessCode ?? "",
      displayName: body.displayName
    });

    return ok({ audienceSession }, 201);
  } catch (error) {
    return fail(error);
  }
}
