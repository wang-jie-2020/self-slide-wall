import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  GET as listHostActivities,
  POST as createHostActivity
} from "../src/app/api/host/activities/route";
import { POST as joinAudienceSession } from "../src/app/api/audience/sessions/route";
import { GET as getAudienceActivity } from "../src/app/api/audience/activities/[accessCode]/route";
import { GET as getDisplayActivity } from "../src/app/api/display/activities/[accessCode]/route";
import { prisma } from "../src/server/prisma";

async function json(response: Response) {
  return response.json() as Promise<unknown>;
}

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function createDraftActivity(title = "TypeScript 现场问答") {
  const response = await createHostActivity(
    postRequest("http://localhost/api/host/activities", {
      title,
      ownerId: "demo-host"
    })
  );

  expect(response.status).toBe(201);
  const body = (await json(response)) as {
    activity: {
      id: string;
      title: string;
      accessCode: string;
      state: string;
      ownerId: string;
      questionCharLimit: number;
      createdAt: string;
    };
  };

  return body.activity;
}

beforeEach(async () => {
  await prisma.audienceSession.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.hostAccount.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("issue #2 vertical slice", () => {
  it("lets a host create a draft activity and see it in the host console list", async () => {
    const activity = await createDraftActivity();

    expect(activity).toMatchObject({
      title: "TypeScript 现场问答",
      state: "DRAFT",
      ownerId: "demo-host",
      questionCharLimit: 240
    });
    expect(activity.accessCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(new Date(activity.createdAt).toString()).not.toBe("Invalid Date");

    const listResponse = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await json(listResponse)) as {
      activities: Array<typeof activity>;
    };

    expect(listBody.activities).toHaveLength(1);
    expect(listBody.activities[0]).toMatchObject({
      id: activity.id,
      accessCode: activity.accessCode,
      state: "DRAFT"
    });
  });

  it("lets an audience member join by access code with an unverified optional display name", async () => {
    const activity = await createDraftActivity();

    const joinResponse = await joinAudienceSession(
      postRequest("http://localhost/api/audience/sessions", {
        accessCode: activity.accessCode,
        displayName: "小王"
      })
    );
    expect(joinResponse.status).toBe(201);
    const joinBody = (await json(joinResponse)) as {
      audienceSession: {
        id: string;
        activityId: string;
        displayName: string | null;
        displayNameVerified: boolean;
      };
    };

    expect(joinBody.audienceSession).toMatchObject({
      activityId: activity.id,
      displayName: "小王",
      displayNameVerified: false
    });

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      { params: Promise.resolve({ accessCode: activity.accessCode }) }
    );
    expect(audienceResponse.status).toBe(200);
    const audienceBody = (await json(audienceResponse)) as {
      activity: {
        id: string;
        state: string;
        acceptsInteraction: boolean;
        audienceNotice: string;
      };
    };

    expect(audienceBody.activity).toMatchObject({
      id: activity.id,
      state: "DRAFT",
      acceptsInteraction: false,
      audienceNotice: "活动仍是草稿，暂不接受提问、点赞或投票。"
    });
  });

  it("shows joining information and a QR-code entry point in the display view", async () => {
    const activity = await createDraftActivity();

    const displayResponse = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      { params: Promise.resolve({ accessCode: activity.accessCode }) }
    );
    expect(displayResponse.status).toBe(200);
    const displayBody = (await json(displayResponse)) as {
      activity: {
        id: string;
        title: string;
        accessCode: string;
        joinUrl: string;
        qrCodeDataUrl: string;
      };
    };

    expect(displayBody.activity).toMatchObject({
      id: activity.id,
      title: activity.title,
      accessCode: activity.accessCode
    });
    expect(displayBody.activity.joinUrl).toBe(
      `http://localhost/join/${activity.accessCode}`
    );
    expect(displayBody.activity.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
