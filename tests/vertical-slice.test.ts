import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  GET as listHostActivities,
  POST as createHostActivity
} from "../src/app/api/host/activities/route";
import {
  DELETE as deleteHostActivity,
  PATCH as updateHostActivity
} from "../src/app/api/host/activities/[activityId]/route";
import { POST as joinAudienceSession } from "../src/app/api/audience/sessions/route";
import { GET as getAudienceActivity } from "../src/app/api/audience/activities/[accessCode]/route";
import { POST as submitAudienceQuestion } from "../src/app/api/audience/activities/[accessCode]/questions/route";
import {
  DELETE as deleteAudienceQuestion,
  PATCH as updateAudienceQuestion
} from "../src/app/api/audience/questions/[questionId]/route";
import { GET as getDisplayActivity } from "../src/app/api/display/activities/[accessCode]/route";
import { POST as likeAudienceQuestion } from "../src/app/api/audience/questions/[questionId]/like/route";
import { POST as moderateQuestion } from "../src/app/api/host/questions/[questionId]/moderate/route";
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

function patchRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function routeActivityId(activityId: string) {
  return { params: Promise.resolve({ activityId }) };
}

function routeAccessCode(accessCode: string) {
  return { params: Promise.resolve({ accessCode }) };
}

function routeQuestionId(questionId: string) {
  return { params: Promise.resolve({ questionId }) };
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

async function joinActivity(accessCode: string, displayName?: string) {
  const response = await joinAudienceSession(
    postRequest("http://localhost/api/audience/sessions", {
      accessCode,
      displayName
    })
  );
  const body = (await json(response)) as {
    audienceSession?: {
      id: string;
      activityId: string;
      displayName: string | null;
      displayNameVerified: boolean;
    };
    error?: string;
  };

  return { response, body };
}

async function moveActivity(activityId: string, action: "start" | "end") {
  const response = await updateHostActivity(
    patchRequest(`http://localhost/api/host/activities/${activityId}`, { action }),
    routeActivityId(activityId)
  );
  const body = (await json(response)) as {
    activity?: {
      id: string;
      state: string;
      accessCode: string;
    };
    error?: string;
  };

  return { response, body };
}

beforeEach(async () => {
  await prisma.questionLike.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.audienceQuestion.deleteMany();
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

describe("issue #3 activity lifecycle", () => {
  it("lets the host start a draft activity and see it as live in the host console list", async () => {
    const activity = await createDraftActivity();

    const { response, body } = await moveActivity(activity.id, "start");

    expect(response.status).toBe(200);
    expect(body.activity).toMatchObject({
      id: activity.id,
      state: "LIVE"
    });

    const listResponse = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const listBody = (await json(listResponse)) as {
      activities: Array<{ id: string; state: string }>;
    };

    expect(listBody.activities).toHaveLength(1);
    expect(listBody.activities[0]).toMatchObject({
      id: activity.id,
      state: "LIVE"
    });
  });

  it("lets the host end a live activity, keeps it read-only, and prevents reopening", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const ended = await moveActivity(activity.id, "end");
    expect(ended.response.status).toBe(200);
    expect(ended.body.activity).toMatchObject({
      id: activity.id,
      state: "ENDED"
    });

    const reopen = await moveActivity(activity.id, "start");
    expect(reopen.response.status).toBe(409);

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
      state: "ENDED",
      acceptsInteraction: false,
      audienceNotice: "活动已结束，仅可查看。"
    });

    const displayResponse = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      { params: Promise.resolve({ accessCode: activity.accessCode }) }
    );
    expect(displayResponse.status).toBe(200);
  });

  it("soft deletes an activity, hides it from the host list, and blocks public access", async () => {
    const activity = await createDraftActivity();

    const deleteResponse = await deleteHostActivity(
      new Request(`http://localhost/api/host/activities/${activity.id}`, {
        method: "DELETE"
      }),
      routeActivityId(activity.id)
    );
    expect(deleteResponse.status).toBe(200);

    const listResponse = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const listBody = (await json(listResponse)) as {
      activities: Array<{ id: string }>;
    };
    expect(listBody.activities).toHaveLength(0);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      { params: Promise.resolve({ accessCode: activity.accessCode }) }
    );
    expect(audienceResponse.status).toBe(404);

    const displayResponse = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      { params: Promise.resolve({ accessCode: activity.accessCode }) }
    );
    expect(displayResponse.status).toBe(404);
  });
});

describe("issue #4 audience question submission", () => {
  it("lets an audience session submit a live question that appears in audience, display, and host views", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode, "小王");
    expect(joined.response.status).toBe(201);
    const audienceSession = joined.body.audienceSession;
    expect(audienceSession).toBeDefined();

    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: audienceSession?.id,
          text: "能不能多讲一下 TypeScript 的类型收窄？"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(submitResponse.status).toBe(201);
    const submitBody = (await json(submitResponse)) as {
      question: {
        id: string;
        activityId: string;
        audienceSessionId: string;
        displayName: string | null;
        text: string;
        createdAt: string;
      };
    };

    expect(submitBody.question).toMatchObject({
      activityId: activity.id,
      audienceSessionId: audienceSession?.id,
      displayName: "小王",
      text: "能不能多讲一下 TypeScript 的类型收窄？"
    });
    expect(new Date(submitBody.question.createdAt).toString()).not.toBe(
      "Invalid Date"
    );

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<typeof submitBody.question> };
    };
    expect(audienceBody.activity.questions).toMatchObject([
      {
        id: submitBody.question.id,
        displayName: "小王",
        text: "能不能多讲一下 TypeScript 的类型收窄？"
      }
    ]);

    const displayResponse = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayResponse)) as {
      activity: { questions: Array<typeof submitBody.question> };
    };
    expect(displayBody.activity.questions).toMatchObject([
      {
        id: submitBody.question.id,
        displayName: "小王",
        text: "能不能多讲一下 TypeScript 的类型收窄？"
      }
    ]);

    const hostResponse = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const hostBody = (await json(hostResponse)) as {
      activities: Array<{ id: string; questions: Array<typeof submitBody.question> }>;
    };
    expect(hostBody.activities[0]).toMatchObject({
      id: activity.id,
      questions: [
        {
          id: submitBody.question.id,
          audienceSessionId: audienceSession?.id,
          displayName: "小王",
          text: "能不能多讲一下 TypeScript 的类型收窄？"
        }
      ]
    });
  });

  it("rejects audience question submission unless the activity is live", async () => {
    const activity = await createDraftActivity();
    const joined = await joinActivity(activity.accessCode);

    const draftSubmit = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "现在可以提问了吗？"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(draftSubmit.status).toBe(409);

    await moveActivity(activity.id, "start");
    await moveActivity(activity.id, "end");

    const endedSubmit = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "结束后还能提问吗？"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(endedSubmit.status).toBe(409);
  });

  it("enforces the activity question character limit", async () => {
    const activity = await createDraftActivity();
    await prisma.activity.update({
      where: { id: activity.id },
      data: { questionCharLimit: 8 }
    });
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const tooLong = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "这个问题超过八个字"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(tooLong.status).toBe(400);

    const withinLimit = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "刚好八字"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(withinLimit.status).toBe(201);
  });

  it("does not expose audience-side edit or delete for submitted questions", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);
    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "提交后不能修改。"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const submitBody = (await json(submitResponse)) as {
      question: { id: string; text: string };
    };

    const editResponse = await updateAudienceQuestion(
      patchRequest(`http://localhost/api/audience/questions/${submitBody.question.id}`, {
        text: "我想修改"
      }),
      routeQuestionId(submitBody.question.id)
    );
    expect(editResponse.status).toBe(405);

    const deleteResponse = await deleteAudienceQuestion(
      new Request(`http://localhost/api/audience/questions/${submitBody.question.id}`, {
        method: "DELETE"
      }),
      routeQuestionId(submitBody.question.id)
    );
    expect(deleteResponse.status).toBe(405);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; text: string }> };
    };
    expect(audienceBody.activity.questions).toMatchObject([
      {
        id: submitBody.question.id,
        text: "提交后不能修改。"
      }
    ]);
  });
});

describe("issue #5 question likes and sorting", () => {
  async function likeQuestion(questionId: string, audienceSessionId: string) {
    const response = await likeAudienceQuestion(
      postRequest(`http://localhost/api/audience/questions/${questionId}/like`, {
        audienceSessionId
      }),
      routeQuestionId(questionId)
    );
    return response;
  }
  it("lets an audience session like a visible question during a live activity", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode, "小王");
    const audienceSession = joined.body.audienceSession;
    expect(audienceSession).toBeDefined();

    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: audienceSession?.id,
          text: "能不能多讲一下 TypeScript？"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    expect(submitResponse.status).toBe(201);
    const submitBody = (await json(submitResponse)) as {
      question: { id: string; text: string };
    };

    const likeResponse = await likeQuestion(
      submitBody.question.id,
      audienceSession?.id ?? ""
    );
    expect(likeResponse.status).toBe(201);
    const likeBody = (await json(likeResponse)) as {
      liked?: boolean;
      error?: string;
    };
    expect(likeBody.liked).toBe(true);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; likeCount: number }> };
    };
    expect(audienceBody.activity.questions[0]).toMatchObject({
      id: submitBody.question.id,
      likeCount: 1
    });
  });

  it("prevents a single audience session from liking the same question twice", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);
    const audienceSession = joined.body.audienceSession;

    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: audienceSession?.id,
          text: "一个问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const submitBody = (await json(submitResponse)) as {
      question: { id: string };
    };

    const first = await likeQuestion(
      submitBody.question.id,
      audienceSession?.id ?? ""
    );
    expect(first.status).toBe(201);

    const second = await likeQuestion(
      submitBody.question.id,
      audienceSession?.id ?? ""
    );
    expect(second.status).toBe(409);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; likeCount: number }> };
    };
    expect(audienceBody.activity.questions[0].likeCount).toBe(1);
  });

  it("allows multiple audience sessions to like the same question", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");

    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "多人点赞的问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const submitBody = (await json(submitResponse)) as {
      question: { id: string };
    };

    const aliceLike = await likeQuestion(
      submitBody.question.id,
      alice.body.audienceSession?.id ?? ""
    );
    expect(aliceLike.status).toBe(201);

    const bobLike = await likeQuestion(
      submitBody.question.id,
      bob.body.audienceSession?.id ?? ""
    );
    expect(bobLike.status).toBe(201);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; likeCount: number }> };
    };
    expect(audienceBody.activity.questions[0].likeCount).toBe(2);
  });

  it("rejects likes when the activity is not live", async () => {
    const activity = await createDraftActivity();
    const joined = await joinActivity(activity.accessCode);

    await moveActivity(activity.id, "start");
    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "活动结束后不能点赞"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const submitBody = (await json(submitResponse)) as {
      question: { id: string };
    };
    await moveActivity(activity.id, "end");

    const likeResponse = await likeQuestion(
      submitBody.question.id,
      joined.body.audienceSession?.id ?? ""
    );
    expect(likeResponse.status).toBe(409);
  });

  it("sorts visible unanswered questions by like count desc then createdAt asc", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");

    // Submit questions in order and note their IDs
    const q1 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "第一个问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q1Body = (await json(q1)) as { question: { id: string } };

    const q2 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "第二个问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q2Body = (await json(q2)) as { question: { id: string } };

    const q3 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "第三个问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q3Body = (await json(q3)) as { question: { id: string } };

    // bob likes q2 (should move to top)
    const bobLike = await likeQuestion(
      q2Body.question.id,
      bob.body.audienceSession?.id ?? ""
    );
    expect(bobLike.status).toBe(201);

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; text: string; likeCount: number }> };
    };

    // q2 (liked) should be first, then q1, then q3 (sorted by createdAt among ties)
    expect(audienceBody.activity.questions).toHaveLength(3);
    expect(audienceBody.activity.questions[0].id).toBe(q2Body.question.id);
    expect(audienceBody.activity.questions[0].likeCount).toBe(1);
    expect(audienceBody.activity.questions[1].id).toBe(q1Body.question.id);
    expect(audienceBody.activity.questions[1].likeCount).toBe(0);
    expect(audienceBody.activity.questions[2].id).toBe(q3Body.question.id);
    expect(audienceBody.activity.questions[2].likeCount).toBe(0);
  });

  it("shows like counts in all three views (audience, display, host)", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode, "小王");

    const submitResponse = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: joined.body.audienceSession?.id,
          text: "大家怎么看"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const submitBody = (await json(submitResponse)) as {
      question: { id: string };
    };

    const likeResponse = await likeQuestion(
      submitBody.question.id,
      joined.body.audienceSession?.id ?? ""
    );
    expect(likeResponse.status).toBe(201);

    // Audience view
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ likeCount: number }> };
    };
    expect(audienceBody.activity.questions[0].likeCount).toBe(1);

    // Display view
    const displayRes = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as {
      activity: { questions: Array<{ likeCount: number }> };
    };
    expect(displayBody.activity.questions[0].likeCount).toBe(1);

    // Host console
    const hostRes = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const hostBody = (await json(hostRes)) as {
      activities: Array<{ questions: Array<{ likeCount: number }> }>;
    };
    expect(hostBody.activities[0].questions[0].likeCount).toBe(1);
  });

  it("keeps pinned questions before unpinned regardless of like count", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");

    // Create an unpinned question and give it likes
    const q1 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "未置顶但很多人点赞"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q1Body = (await json(q1)) as { question: { id: string } };

    // bob likes the unpinned question
    await likeQuestion(
      q1Body.question.id,
      bob.body.audienceSession?.id ?? ""
    );

    // Create a pinned question with no likes
    const q2 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        {
          audienceSessionId: alice.body.audienceSession?.id,
          text: "置顶问题"
        }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q2Body = (await json(q2)) as { question: { id: string } };

    // Pin q2 via direct DB update
    await prisma.audienceQuestion.update({
      where: { id: q2Body.question.id },
      data: { isPinned: true }
    });

    const audienceResponse = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceResponse)) as {
      activity: { questions: Array<{ id: string; likeCount: number; isPinned: boolean }> };
    };

    expect(audienceBody.activity.questions).toHaveLength(2);
    // Pinned question should come first despite having 0 likes vs 1 like
    expect(audienceBody.activity.questions[0].id).toBe(q2Body.question.id);
    expect(audienceBody.activity.questions[0].isPinned).toBe(true);
    expect(audienceBody.activity.questions[0].likeCount).toBe(0);
    expect(audienceBody.activity.questions[1].id).toBe(q1Body.question.id);
    expect(audienceBody.activity.questions[1].likeCount).toBe(1);
  });
});



describe("issue #6 moderation question management", () => {
  async function moderate(questionId: string, action: string) {
    const response = await moderateQuestion(
      postRequest(`http://localhost/api/host/questions/${questionId}/moderate`, { action }),
      { params: Promise.resolve({ questionId }) }
    );
    return response;
  }

  it("lets the host pin a question so it appears first in audience and display views", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    // Submit two questions
    const q1 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "第一个问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q1Body = (await json(q1)) as { question: { id: string } };

    const q2 = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "第二个问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const q2Body = (await json(q2)) as { question: { id: string } };

    // Pin the second question
    const pinRes = await moderate(q2Body.question.id, "pin");
    expect(pinRes.status).toBe(200);

    // Audience view: pinned question should be first
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ id: string; isPinned: boolean }> };
    };
    expect(audienceBody.activity.questions).toHaveLength(2);
    expect(audienceBody.activity.questions[0].id).toBe(q2Body.question.id);
    expect(audienceBody.activity.questions[0].isPinned).toBe(true);
    expect(audienceBody.activity.questions[1].id).toBe(q1Body.question.id);
    expect(audienceBody.activity.questions[1].isPinned).toBe(false);

    // Display view: pinned question should be first
    const displayRes = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as {
      activity: { questions: Array<{ id: string; isPinned: boolean }> };
    };
    expect(displayBody.activity.questions[0].id).toBe(q2Body.question.id);
    expect(displayBody.activity.questions[0].isPinned).toBe(true);
  });

  it("rejects pinning a hidden question", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "被隐藏的问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    await prisma.audienceQuestion.update({
      where: { id: qBody.question.id },
      data: { isHidden: true }
    });

    const pinRes = await moderate(qBody.question.id, "pin");
    expect(pinRes.status).toBe(409);
  });

  it("lets the host unpin a pinned question and return to normal sorting", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "先置顶再取消" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    await moderate(qBody.question.id, "pin");

    // Unpin
    const unpinRes = await moderate(qBody.question.id, "unpin");
    expect(unpinRes.status).toBe(200);

    // Verify it is no longer pinned in audience view
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ id: string; isPinned: boolean }> };
    };
    expect(audienceBody.activity.questions).toHaveLength(1);
    expect(audienceBody.activity.questions[0].isPinned).toBe(false);
  });

  it("lets the host mark a question as answered, removing it from audience and display views", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "已回答的问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    const answerRes = await moderate(qBody.question.id, "answer");
    expect(answerRes.status).toBe(200);

    // Audience view should not include answered question
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ id: string }> };
    };
    expect(audienceBody.activity.questions).toHaveLength(0);

    // Display view should not include answered question
    const displayRes = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as {
      activity: { questions: Array<{ id: string }> };
    };
    expect(displayBody.activity.questions).toHaveLength(0);

    // Host console should still show the answered question
    const hostRes = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const hostBody = (await json(hostRes)) as {
      activities: Array<{ questions: Array<{ id: string; isAnswered: boolean }> }>;
    };
    expect(hostBody.activities[0].questions).toHaveLength(1);
    expect(hostBody.activities[0].questions[0].id).toBe(qBody.question.id);
    expect(hostBody.activities[0].questions[0].isAnswered).toBe(true);
  });

  it("lets the host restore an answered question to the unanswered flow", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "恢复的问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    await moderate(qBody.question.id, "answer");

    // Restore
    const restoreRes = await moderate(qBody.question.id, "restore");
    expect(restoreRes.status).toBe(200);

    // Should reappear in audience view
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ id: string; isAnswered: boolean }> };
    };
    expect(audienceBody.activity.questions).toHaveLength(1);
    expect(audienceBody.activity.questions[0].id).toBe(qBody.question.id);
    expect(audienceBody.activity.questions[0].isAnswered).toBe(false);
  });

  it("lets the host hide a question, removing it from all public views", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "需要隐藏的问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    const hideRes = await moderate(qBody.question.id, "hide");
    expect(hideRes.status).toBe(200);

    // Audience view should not include hidden question
    const audienceRes = await getAudienceActivity(
      new Request(`http://localhost/api/audience/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as {
      activity: { questions: Array<{ id: string }> };
    };
    expect(audienceBody.activity.questions).toHaveLength(0);

    // Display view should not include hidden question
    const displayRes = await getDisplayActivity(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as {
      activity: { questions: Array<{ id: string }> };
    };
    expect(displayBody.activity.questions).toHaveLength(0);

    // Host console should still show the hidden question
    const hostRes = await listHostActivities(
      new Request("http://localhost/api/host/activities?ownerId=demo-host")
    );
    const hostBody = (await json(hostRes)) as {
      activities: Array<{ questions: Array<{ id: string; isHidden: boolean }> }>;
    };
    expect(hostBody.activities[0].questions).toHaveLength(1);
    expect(hostBody.activities[0].questions[0].id).toBe(qBody.question.id);
    expect(hostBody.activities[0].questions[0].isHidden).toBe(true);
  });

  it("rejects unknown moderation actions", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "任意问题" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    const res = await moderate(qBody.question.id, "unknown");
    expect(res.status).toBe(400);
  });

  it("hides moderation buttons for hidden questions and prevents further moderation", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const q = await submitAudienceQuestion(
      postRequest(
        `http://localhost/api/audience/activities/${activity.accessCode}/questions`,
        { audienceSessionId: joined.body.audienceSession?.id, text: "隐藏后不再操作" }
      ),
      routeAccessCode(activity.accessCode)
    );
    const qBody = (await json(q)) as { question: { id: string } };

    await moderate(qBody.question.id, "hide");

    // Pin should fail on hidden question
    const pinRes = await moderate(qBody.question.id, "pin");
    expect(pinRes.status).toBe(409);
  });
});
