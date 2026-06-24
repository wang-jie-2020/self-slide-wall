import { randomInt } from "crypto";
import QRCode from "qrcode";

import { prisma } from "./prisma";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_LENGTH = 6;
const DEFAULT_OWNER_ID = "demo-host";
const DEFAULT_OWNER_NAME = "示例主持账号";
const DEFAULT_QUESTION_CHAR_LIMIT = 240;

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
  return prisma.activity.findMany({
    where: {
      ownerId: ownerId?.trim() || DEFAULT_OWNER_ID,
      deletedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });
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
  const activity = await findPublicActivityByAccessCode(accessCode);
  if (!activity) {
    throw new RequestError("找不到可访问的活动。", 404);
  }

  return {
    ...activity,
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
  const activity = await findPublicActivityByAccessCode(accessCode);
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
    ...activity,
    joinUrl,
    qrCodeDataUrl
  };
}

async function findPublicActivityByAccessCode(accessCode: string) {
  return prisma.activity.findFirst({
    where: {
      accessCode: accessCode.trim().toUpperCase(),
      deletedAt: null
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

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}
