import { randomInt } from "crypto";
import QRCode from "qrcode";

import { prisma } from "./prisma";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_LENGTH = 6;
const DEFAULT_OWNER_ID = "demo-host";
const DEFAULT_OWNER_NAME = "示例主持账号";
const DEFAULT_QUESTION_CHAR_LIMIT = 240;

type AudienceQuestionRecord = {
  id: string;
  activityId: string;
  audienceSessionId: string;
  text: string;
  createdAt: Date;
  isPinned: boolean;
  isAnswered: boolean;
  isHidden: boolean;
  audienceSession: {
    displayName: string | null;
  };
  _count?: {
    questionLikes: number;
  };
};

export type RouteActivityContext = {
  params: Promise<{ accessCode: string }>;
};

export type RouteHostActivityContext = {
  params: Promise<{ activityId: string }>;
};

export async function resolveAccessCode(
  context: RouteActivityContext
): Promise<string> {
  const params = await context.params;
  return params.accessCode;
}

export async function resolveActivityId(
  context: RouteHostActivityContext
): Promise<string> {
  const params = await context.params;
  return params.activityId;
}

export async function createDraftActivity(input: {
  title: string;
  ownerId?: string;
}) {
  const title = input.title.trim();
  if (!title) {
    throw new RequestError("活动标题不能为空。", 400);
  }

  const ownerId = input.ownerId?.trim() || DEFAULT_OWNER_ID;
  await prisma.hostAccount.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      name: ownerId === DEFAULT_OWNER_ID ? DEFAULT_OWNER_NAME : ownerId
    }
  });

  return prisma.activity.create({
    data: {
      title,
      ownerId,
      accessCode: await generateUniqueAccessCode(),
      questionCharLimit: DEFAULT_QUESTION_CHAR_LIMIT
    }
  });
}

export async function listOwnedActivities(ownerId?: string) {
  const activities = await prisma.activity.findMany({
    where: {
      ownerId: ownerId?.trim() || DEFAULT_OWNER_ID,
      deletedAt: null
    },
    include: {
      audienceQuestions: hostQuestionInclude()
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return activities.map(withAllQuestions);
}

export async function startActivity(activityId: string) {
  const activity = await findAccessibleActivityById(activityId);
  if (!activity) {
    throw new RequestError("找不到可管理的活动。", 404);
  }
  if (activity.state !== "DRAFT") {
    throw new RequestError(
      activity.state === "ENDED"
        ? "已结束活动不能重新开启。"
        : "只有草稿活动可以开始。",
      409
    );
  }

  return prisma.activity.update({
    where: { id: activity.id },
    data: { state: "LIVE" }
  });
}

export async function endActivity(activityId: string) {
  const activity = await findAccessibleActivityById(activityId);
  if (!activity) {
    throw new RequestError("找不到可管理的活动。", 404);
  }
  if (activity.state !== "LIVE") {
    throw new RequestError("只有进行中活动可以结束。", 409);
  }

  return prisma.activity.update({
    where: { id: activity.id },
    data: { state: "ENDED" }
  });
}

export async function softDeleteActivity(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  });
  if (!activity) {
    throw new RequestError("找不到可删除的活动。", 404);
  }
  if (activity.deletedAt) {
    return activity;
  }

  return prisma.activity.update({
    where: { id: activity.id },
    data: { deletedAt: new Date() }
  });
}

export async function createAudienceSession(input: {
  accessCode: string;
  displayName?: string | null;
}) {
  const activity = await findPublicActivityByAccessCode(input.accessCode);
  if (!activity) {
    throw new RequestError("找不到可加入的活动。", 404);
  }

  const displayName = input.displayName?.trim() || null;
  const audienceSession = await prisma.audienceSession.create({
    data: {
      activityId: activity.id,
      displayName
    }
  });

  return {
    ...audienceSession,
    displayNameVerified: false
  };
}

export async function getAudienceActivity(accessCode: string) {
  const activity = await findPublicActivityWithQuestionsByAccessCode(accessCode);
  if (!activity) {
    throw new RequestError("找不到可访问的活动。", 404);
  }

  return {
    ...withPublicQuestions(activity),
    acceptsInteraction: activity.state === "LIVE",
    audienceNotice:
      activity.state === "DRAFT"
        ? "活动仍是草稿，暂不接受提问、点赞或投票。"
        : activity.state === "ENDED"
          ? "活动已结束，仅可查看。"
          : "活动正在进行，可以参与互动。"
  };
}

export async function getDisplayActivity(accessCode: string, origin: string) {
  const activity = await findPublicActivityWithQuestionsByAccessCode(accessCode);
  if (!activity) {
    throw new RequestError("找不到可展示的活动。", 404);
  }

  const joinUrl = `${origin}/join/${activity.accessCode}`;
  const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280
  });

  return {
    ...withPublicQuestions(activity),
    joinUrl,
    qrCodeDataUrl
  };
}

export async function submitAudienceQuestion(input: {
  accessCode: string;
  audienceSessionId: string;
  text: string;
}) {
  const activity = await findPublicActivityByAccessCode(input.accessCode);
  if (!activity) {
    throw new RequestError("找不到可提问的活动。", 404);
  }
  if (activity.state !== "LIVE") {
    throw new RequestError("只有进行中活动可以提交观众问题。", 409);
  }

  const text = input.text.trim();
  if (!text) {
    throw new RequestError("观众问题不能为空。", 400);
  }
  if (text.length > activity.questionCharLimit) {
    throw new RequestError("观众问题超过活动的问题字数限制。", 400);
  }

  const audienceSession = await prisma.audienceSession.findFirst({
    where: {
      id: input.audienceSessionId,
      activityId: activity.id
    },
    select: { id: true }
  });
  if (!audienceSession) {
    throw new RequestError("找不到此活动的观众会话。", 404);
  }

  const question = await prisma.audienceQuestion.create({
    data: {
      activityId: activity.id,
      audienceSessionId: audienceSession.id,
      text
    },
    include: {
      audienceSession: {
        select: {
          displayName: true
        }
      }
    }
  });

  return toAudienceQuestion(question);
}

export async function toggleQuestionLike(input: {
  questionId: string;
  audienceSessionId: string;
}) {
  const question = await prisma.audienceQuestion.findFirst({
    where: {
      id: input.questionId,
      isHidden: false,
      isAnswered: false
    },
    include: {
      activity: { select: { state: true } }
    }
  });
  if (!question) {
    throw new RequestError("找不到可点赞的观众问题。", 404);
  }
  if (question.activity.state !== "LIVE") {
    throw new RequestError("只有进行中活动可以点赞。", 409);
  }

  const audienceSession = await prisma.audienceSession.findFirst({
    where: {
      id: input.audienceSessionId,
      activityId: question.activityId
    },
    select: { id: true }
  });
  if (!audienceSession) {
    throw new RequestError("找不到此活动的观众会话。", 404);
  }

  const existing = await prisma.questionLike.findUnique({
    where: {
      audienceQuestionId_audienceSessionId: {
        audienceQuestionId: question.id,
        audienceSessionId: audienceSession.id
      }
    }
  });
  if (existing) {
    throw new RequestError("已经点过赞了。", 409);
  }

  await prisma.questionLike.create({
    data: {
      audienceQuestionId: question.id,
      audienceSessionId: audienceSession.id
    }
  });

  return { liked: true };
}

export async function pinQuestion(questionId: string) {
  const question = await prisma.audienceQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, isHidden: true, isAnswered: true }
  });
  if (!question) {
    throw new RequestError("找不到可操作的观众问题。", 404);
  }
  if (question.isHidden) {
    throw new RequestError("不能置顶已隐藏的问题。", 409);
  }
  if (question.isAnswered) {
    throw new RequestError("不能置顶已回答的问题。", 409);
  }

  await prisma.audienceQuestion.update({
    where: { id: questionId },
    data: { isPinned: true }
  });

  return { pinned: true };
}

export async function unpinQuestion(questionId: string) {
  const question = await prisma.audienceQuestion.findUnique({
    where: { id: questionId },
    select: { id: true }
  });
  if (!question) {
    throw new RequestError("找不到可操作的观众问题。", 404);
  }

  await prisma.audienceQuestion.update({
    where: { id: questionId },
    data: { isPinned: false }
  });

  return { pinned: false };
}

export async function markQuestionAnswered(questionId: string) {
  const question = await prisma.audienceQuestion.findUnique({
    where: { id: questionId },
    select: { id: true }
  });
  if (!question) {
    throw new RequestError("找不到可操作的观众问题。", 404);
  }

  await prisma.audienceQuestion.update({
    where: { id: questionId },
    data: { isAnswered: true, isPinned: false }
  });

  return { answered: true };
}

export async function restoreQuestion(questionId: string) {
  const question = await prisma.audienceQuestion.findUnique({
    where: { id: questionId },
    select: { id: true }
  });
  if (!question) {
    throw new RequestError("找不到可操作的观众问题。", 404);
  }

  await prisma.audienceQuestion.update({
    where: { id: questionId },
    data: { isAnswered: false }
  });

  return { answered: false };
}

export async function hideQuestion(questionId: string) {
  await prisma.audienceQuestion.update({
    where: { id: questionId },
    data: { isHidden: true, isPinned: false, isAnswered: false }
  });

  return { hidden: true };
}

export function audienceQuestionMutationNotAllowed() {
  return new RequestError("观众问题提交后不能由观众编辑或删除。", 405);
}

async function findPublicActivityByAccessCode(accessCode: string) {
  return prisma.activity.findFirst({
    where: {
      accessCode: accessCode.trim().toUpperCase(),
      deletedAt: null
    }
  });
}

async function findPublicActivityWithQuestionsByAccessCode(accessCode: string) {
  return prisma.activity.findFirst({
    where: {
      accessCode: accessCode.trim().toUpperCase(),
      deletedAt: null
    },
    include: {
      audienceQuestions: hostQuestionInclude()
    }
  });
}

async function findAccessibleActivityById(activityId: string) {
  return prisma.activity.findFirst({
    where: {
      id: activityId,
      deletedAt: null
    }
  });
}

async function generateUniqueAccessCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const accessCode = generateAccessCode();
    const existing = await prisma.activity.findUnique({
      where: { accessCode },
      select: { id: true }
    });
    if (!existing) {
      return accessCode;
    }
  }

  throw new RequestError("访问码生成失败，请重试。", 500);
}

function generateAccessCode() {
  let accessCode = "";
  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    accessCode += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return accessCode;
}

function visibleQuestionInclude() {
  return {
    where: {
      isHidden: false,
      isAnswered: false
    },
    include: {
      audienceSession: {
        select: {
          displayName: true
        }
      },
      _count: {
        select: {
          questionLikes: true
        }
      }
    },
    orderBy: [{ isPinned: "desc" as const }, { createdAt: "asc" as const }]
  };
}

function hostQuestionInclude() {
  return {
    include: {
      audienceSession: {
        select: {
          displayName: true
        }
      },
      _count: {
        select: {
          questionLikes: true
        }
      }
    }
  };
}

function toAudienceQuestion(question: AudienceQuestionRecord) {
  return {
    id: question.id,
    activityId: question.activityId,
    audienceSessionId: question.audienceSessionId,
    displayName: question.audienceSession.displayName,
    text: question.text,
    createdAt: question.createdAt,
    isPinned: question.isPinned,
    isAnswered: question.isAnswered,
    isHidden: question.isHidden,
    likeCount: question._count?.questionLikes ?? 0
  };
}

function withAllQuestions<
  TActivity extends { audienceQuestions: AudienceQuestionRecord[] }
>(activity: TActivity) {
  const { audienceQuestions, ...restActivity } = activity;

  const questions = audienceQuestions.map(toAudienceQuestion);
  questions.sort(compareQuestionSort);

  return {
    ...restActivity,
    questions
  };
}

function withPublicQuestions<
  TActivity extends { audienceQuestions: AudienceQuestionRecord[] }
>(activity: TActivity) {
  const { audienceQuestions, ...visibleActivity } = activity;

  const questions = audienceQuestions
    .filter((q) => !q.isHidden && !q.isAnswered)
    .map(toAudienceQuestion);
  questions.sort(compareQuestionSort);

  return {
    ...visibleActivity,
    questions
  };
}

function compareQuestionSort(
  a: ReturnType<typeof toAudienceQuestion>,
  b: ReturnType<typeof toAudienceQuestion>
): number {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }
  if (a.likeCount !== b.likeCount) {
    return b.likeCount - a.likeCount;
  }
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}
