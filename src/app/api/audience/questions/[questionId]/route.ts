import { audienceQuestionMutationNotAllowed } from "@/server/activity-service";
import { fail } from "../../../respond";

type RouteAudienceQuestionContext = {
  params: Promise<{ questionId: string }>;
};

export async function PATCH(
  _request: Request,
  _context: RouteAudienceQuestionContext
) {
  return fail(audienceQuestionMutationNotAllowed());
}

export async function DELETE(
  _request: Request,
  _context: RouteAudienceQuestionContext
) {
  return fail(audienceQuestionMutationNotAllowed());
}
