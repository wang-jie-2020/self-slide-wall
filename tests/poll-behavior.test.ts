import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { GET as listHostActivities, POST as createHostActivity } from "../src/app/api/host/activities/route";
import { PATCH as updateHostActivity } from "../src/app/api/host/activities/[activityId]/route";
import { POST as joinAudienceSession } from "../src/app/api/audience/sessions/route";
import { GET as getAudienceActivity } from "../src/app/api/audience/activities/[accessCode]/route";
import { GET as getDisplayActivity } from "../src/app/api/display/activities/[accessCode]/route";

// Poll routes
import { GET as listHostPolls, POST as createHostPoll } from "../src/app/api/host/activities/[activityId]/polls/route";
import { DELETE as deleteHostPoll, PATCH as updateHostPoll } from "../src/app/api/host/polls/[pollId]/route";
import { POST as reorderHostPolls } from "../src/app/api/host/activities/[activityId]/polls/reorder/route";
import { GET as listAudiencePolls } from "../src/app/api/audience/activities/[accessCode]/polls/route";
import { POST as castAudienceVote } from "../src/app/api/audience/polls/[pollId]/vote/route";
import { GET as listDisplayPolls } from "../src/app/api/display/activities/[accessCode]/polls/route";

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

function routePollId(pollId: string) {
  return { params: Promise.resolve({ pollId }) };
}

function audiencePollsUrl(accessCode: string, audienceSessionId: string) {
  return `http://localhost/api/audience/activities/${accessCode}/polls?audienceSessionId=${audienceSessionId}`;
}

async function createDraftActivity(title = "TypeScript 现场问答") {
  const response = await createHostActivity(
    postRequest("http://localhost/api/host/activities", { title, ownerId: "demo-host" })
  );
  expect(response.status).toBe(201);
  const body = (await json(response)) as {
    activity: { id: string; accessCode: string; state: string };
  };
  return body.activity;
}

async function joinActivity(accessCode: string, displayName?: string) {
  const response = await joinAudienceSession(
    postRequest("http://localhost/api/audience/sessions", { accessCode, displayName })
  );
  const body = (await json(response)) as {
    audienceSession?: { id: string; displayName: string | null };
    error?: string;
  };
  return { response, body };
}

async function moveActivity(activityId: string, action: "start" | "end") {
  const response = await updateHostActivity(
    patchRequest(`http://localhost/api/host/activities/${activityId}`, { action }),
    routeActivityId(activityId)
  );
  return response;
}

async function createPoll(activityId: string, prompt: string, options: string[]) {
  const response = await createHostPoll(
    postRequest(`http://localhost/api/host/activities/${activityId}/polls`, {
      prompt,
      options: options.map((text) => ({ text }))
    }),
    routeActivityId(activityId)
  );
  const body = (await json(response)) as {
    poll?: { id: string; prompt: string; totalVotes: number; options: Array<{ id: string; text: string; count: number; percentage: number }> };
    error?: string;
  };
  return { response, body };
}

async function castVote(pollId: string, audienceSessionId: string, pollOptionId: string) {
  const response = await castAudienceVote(
    postRequest(`http://localhost/api/audience/polls/${pollId}/vote`, {
      audienceSessionId,
      pollOptionId
    }),
    routePollId(pollId)
  );
  const body = (await json(response)) as { voted?: boolean; error?: string };
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

describe("issue #7 poll creation, voting, and result visibility", () => {
  it("lets the host create a poll with prompt and options for a live activity", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const { response, body } = await createPoll(activity.id, "你最喜欢哪个框架？", [
      "React",
      "Vue",
      "Angular"
    ]);

    expect(response.status).toBe(201);
    expect(body.poll).toBeDefined();
    expect(body.poll).toMatchObject({
      prompt: "你最喜欢哪个框架？",
      totalVotes: 0
    });
    expect(body.poll!.options).toHaveLength(3);
    expect(body.poll!.options[0]).toMatchObject({ text: "React", count: 0, percentage: 0 });
    expect(body.poll!.options[1]).toMatchObject({ text: "Vue", count: 0, percentage: 0 });
    expect(body.poll!.options[2]).toMatchObject({ text: "Angular", count: 0, percentage: 0 });
  });

  it("rejects poll creation if activity is not live", async () => {
    const activity = await createDraftActivity();

    const { response } = await createPoll(activity.id, "测试投票", ["A", "B"]);
    expect(response.status).toBe(409);
  });

  it("rejects poll creation with fewer than two options", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const { response } = await createPoll(activity.id, "测试", []);
    expect(response.status).toBe(400);
  });

  it("lets an audience session select one option per poll", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode, "小王");
    const sessionId = joined.body.audienceSession!.id;

    const { body: pollBody } = await createPoll(activity.id, "测试投票", ["A", "B"]);
    const poll = pollBody.poll!;
    const optionA = poll.options[0];

    const { response } = await castVote(poll.id, sessionId, optionA.id);
    expect(response.status).toBe(201);

    // Verify vote is registered in host view
    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<typeof poll> };
    expect(hostBody.polls[0].totalVotes).toBe(1);
    expect(hostBody.polls[0].options[0].count).toBe(1);
    expect(hostBody.polls[0].options[1].count).toBe(0);
  });

  it("lets an audience session change their vote before poll closes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode, "小王");
    const sessionId = joined.body.audienceSession!.id;

    const { body: pollBody } = await createPoll(activity.id, "测试投票", ["A", "B"]);
    const poll = pollBody.poll!;

    // Vote for A
    await castVote(poll.id, sessionId, poll.options[0].id);

    // Change to B
    const { response } = await castVote(poll.id, sessionId, poll.options[1].id);
    expect(response.status).toBe(201);

    // Verify counts shifted
    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<typeof poll> };
    expect(hostBody.polls[0].totalVotes).toBe(1);
    expect(hostBody.polls[0].options[0].count).toBe(0);
    expect(hostBody.polls[0].options[1].count).toBe(1);
  });

  it("shows the audience view only the current session's own choice, not aggregate results", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");

    const { body: pollBody } = await createPoll(activity.id, "测试投票", ["A", "B"]);
    const poll = pollBody.poll!;

    // Alice votes A, Bob votes B
    await castVote(poll.id, alice.body.audienceSession!.id, poll.options[0].id);
    await castVote(poll.id, bob.body.audienceSession!.id, poll.options[1].id);

    // Alice's view: only sees her own option, no counts
    const aliceRes = await listAudiencePolls(
      new Request(audiencePollsUrl(activity.accessCode, alice.body.audienceSession!.id)),
      routeAccessCode(activity.accessCode)
    );
    const aliceBody = (await json(aliceRes)) as {
      polls: Array<{
        id: string;
        prompt: string;
        myOptionId: string | null;
        options: Array<{ id: string; text: string }>;
      }>;
    };

    expect(aliceBody.polls[0].myOptionId).toBe(poll.options[0].id);
    // Verify no aggregate data is leaked: no count, percentage, or totalVotes fields
    expect(aliceBody.polls[0]).not.toHaveProperty("totalVotes");
    for (const option of aliceBody.polls[0].options) {
      expect(option).not.toHaveProperty("count");
      expect(option).not.toHaveProperty("percentage");
    }
  });

  it("shows the display view poll results as percentages without raw counts", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");

    const { body: pollBody } = await createPoll(activity.id, "测试投票", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, alice.body.audienceSession!.id, poll.options[0].id);
    await castVote(poll.id, bob.body.audienceSession!.id, poll.options[1].id);

    const displayRes = await listDisplayPolls(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}/polls`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as {
      polls: Array<{
        id: string;
        totalVotes: number;
        options: Array<{ id: string; text: string; percentage: number }>;
      }>;
    };

    expect(displayBody.polls[0].totalVotes).toBe(2);
    // Each option has 50%
    expect(displayBody.polls[0].options[0].percentage).toBe(50);
    expect(displayBody.polls[0].options[1].percentage).toBe(50);
    // No raw counts in display view
    for (const option of displayBody.polls[0].options) {
      expect(option).not.toHaveProperty("count");
    }
  });

  it("shows the host console poll results as percentages and raw counts", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");
    const bob = await joinActivity(activity.accessCode, "Bob");
    const charlie = await joinActivity(activity.accessCode, "Charlie");

    const { body: pollBody } = await createPoll(activity.id, "测试投票", ["A", "B", "C"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, alice.body.audienceSession!.id, poll.options[0].id);
    await castVote(poll.id, bob.body.audienceSession!.id, poll.options[0].id);
    await castVote(poll.id, charlie.body.audienceSession!.id, poll.options[2].id);

    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as {
      polls: Array<{
        options: Array<{ text: string; count: number; percentage: number }>;
        totalVotes: number;
      }>;
    };

    expect(hostBody.polls[0].totalVotes).toBe(3);
    expect(hostBody.polls[0].options[0]).toMatchObject({ text: "A", count: 2, percentage: 67 });
    expect(hostBody.polls[0].options[1]).toMatchObject({ text: "B", count: 0, percentage: 0 });
    expect(hostBody.polls[0].options[2]).toMatchObject({ text: "C", count: 1, percentage: 33 });
  });

  it("allows an activity to have multiple concurrent polls", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    await createPoll(activity.id, "问题一", ["A", "B"]);
    await createPoll(activity.id, "问题二", ["X", "Y"]);

    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<{ prompt: string }> };
    expect(hostBody.polls).toHaveLength(2);
    expect(hostBody.polls[1].prompt).toBe("问题一");
    expect(hostBody.polls[0].prompt).toBe("问题二"); // newer first
  });
});

describe("issue #8 poll ordering, closing, and trust rules", () => {
  it("places newly created polls first by default", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    await createPoll(activity.id, "先创建的", ["A", "B"]);
    await createPoll(activity.id, "后创建的", ["C", "D"]);

    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<{ prompt: string }> };
    expect(hostBody.polls[0].prompt).toBe("后创建的");
    expect(hostBody.polls[1].prompt).toBe("先创建的");
  });

  it("lets the host reorder polls and shares the order across audience and display views", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const { body: p1 } = await createPoll(activity.id, "第一个", ["A", "B"]);
    const { body: p2 } = await createPoll(activity.id, "第二个", ["C", "D"]);
    const { body: p3 } = await createPoll(activity.id, "第三个", ["E", "F"]);

    // Reorder: put p1 first, p3 second, p2 last
    const reorderRes = await reorderHostPolls(
      postRequest(`http://localhost/api/host/activities/${activity.id}/polls/reorder`, {
        pollIds: [p1.poll!.id, p3.poll!.id, p2.poll!.id]
      }),
      routeActivityId(activity.id)
    );
    expect(reorderRes.status).toBe(200);

    // Check host view
    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<{ id: string }> };
    expect(hostBody.polls[0].id).toBe(p1.poll!.id);
    expect(hostBody.polls[1].id).toBe(p3.poll!.id);
    expect(hostBody.polls[2].id).toBe(p2.poll!.id);

    // Check audience view uses same order
    const audienceRes = await listAudiencePolls(
      new Request(audiencePollsUrl(activity.accessCode, joined.body.audienceSession!.id)),
      routeAccessCode(activity.accessCode)
    );
    const audienceBody = (await json(audienceRes)) as { polls: Array<{ id: string }> };
    expect(audienceBody.polls[0].id).toBe(p1.poll!.id);
    expect(audienceBody.polls[1].id).toBe(p3.poll!.id);
    expect(audienceBody.polls[2].id).toBe(p2.poll!.id);

    // Check display view uses same order
    const displayRes = await listDisplayPolls(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}/polls`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as { polls: Array<{ id: string }> };
    expect(displayBody.polls[0].id).toBe(p1.poll!.id);
    expect(displayBody.polls[1].id).toBe(p3.poll!.id);
    expect(displayBody.polls[2].id).toBe(p2.poll!.id);
  });

  it("allows editing a poll before it receives any votes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const { body: pollBody } = await createPoll(activity.id, "原始问题", ["A", "B"]);
    const poll = pollBody.poll!;

    const editRes = await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, {
        prompt: "修改后的问题",
        options: [{ text: "X" }, { text: "Y" }]
      }),
      routePollId(poll.id)
    );
    expect(editRes.status).toBe(200);
    const editBody = (await json(editRes)) as {
      prompt: string;
      options: Array<{ text: string }>;
    };
    expect(editBody.prompt).toBe("修改后的问题");
    expect(editBody.options).toHaveLength(2);
    expect(editBody.options[0].text).toBe("X");
    expect(editBody.options[1].text).toBe("Y");
  });

  it("allows deleting a poll before it receives any votes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const { body: pollBody } = await createPoll(activity.id, "待删除", ["A", "B"]);
    const poll = pollBody.poll!;

    const deleteRes = await deleteHostPoll(
      new Request(`http://localhost/api/host/polls/${poll.id}`, { method: "DELETE" }),
      routePollId(poll.id)
    );
    expect(deleteRes.status).toBe(200);

    const hostRes = await listHostPolls(
      new Request(`http://localhost/api/host/activities/${activity.id}/polls`),
      routeActivityId(activity.id)
    );
    const hostBody = (await json(hostRes)) as { polls: Array<unknown> };
    expect(hostBody.polls).toHaveLength(0);
  });

  it("prevents editing a poll after it receives at least one vote", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const { body: pollBody } = await createPoll(activity.id, "不可编辑", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, joined.body.audienceSession!.id, poll.options[0].id);

    const editRes = await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, {
        prompt: "尝试修改"
      }),
      routePollId(poll.id)
    );
    expect(editRes.status).toBe(409);
  });

  it("prevents deleting a poll after it receives at least one vote", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const { body: pollBody } = await createPoll(activity.id, "不可删除", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, joined.body.audienceSession!.id, poll.options[0].id);

    const deleteRes = await deleteHostPoll(
      new Request(`http://localhost/api/host/polls/${poll.id}`, { method: "DELETE" }),
      routePollId(poll.id)
    );
    expect(deleteRes.status).toBe(409);
  });

  it("lets the host close a poll that has received votes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const { body: pollBody } = await createPoll(activity.id, "可关闭", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, joined.body.audienceSession!.id, poll.options[0].id);

    const closeRes = await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, { action: "close" }),
      routePollId(poll.id)
    );
    expect(closeRes.status).toBe(200);
    const closeBody = (await json(closeRes)) as { isClosed: boolean };
    expect(closeBody.isClosed).toBe(true);
  });

  it("allows closing a poll that has no votes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    const { body: pollBody } = await createPoll(activity.id, "无票也可关", ["A", "B"]);
    const poll = pollBody.poll!;

    const closeRes = await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, { action: "close" }),
      routePollId(poll.id)
    );
    expect(closeRes.status).toBe(200);
    const closeBody = (await json(closeRes)) as { isClosed: boolean };
    expect(closeBody.isClosed).toBe(true);
  });

  it("prevents voting on a closed poll", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const joined = await joinActivity(activity.accessCode);

    const { body: pollBody } = await createPoll(activity.id, "关了就不能投", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, joined.body.audienceSession!.id, poll.options[0].id);
    await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, { action: "close" }),
      routePollId(poll.id)
    );

    // Try to vote again after close
    const { response } = await castVote(poll.id, joined.body.audienceSession!.id, poll.options[1].id);
    expect(response.status).toBe(409);
  });

  it("displays closed poll results but rejects new votes", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");
    const alice = await joinActivity(activity.accessCode, "Alice");

    const { body: pollBody } = await createPoll(activity.id, "关闭后结果", ["A", "B"]);
    const poll = pollBody.poll!;

    await castVote(poll.id, alice.body.audienceSession!.id, poll.options[0].id);
    await updateHostPoll(
      patchRequest(`http://localhost/api/host/polls/${poll.id}`, { action: "close" }),
      routePollId(poll.id)
    );

    // Display still shows results
    const displayRes = await listDisplayPolls(
      new Request(`http://localhost/api/display/activities/${activity.accessCode}/polls`),
      routeAccessCode(activity.accessCode)
    );
    const displayBody = (await json(displayRes)) as { polls: Array<{ isClosed: boolean; totalVotes: number }> };
    expect(displayBody.polls[0].isClosed).toBe(true);
    expect(displayBody.polls[0].totalVotes).toBe(1);
  });

  it("rejects audience poll access without a valid session", async () => {
    const activity = await createDraftActivity();
    await moveActivity(activity.id, "start");

    await createPoll(activity.id, "测试", ["A", "B"]);

    const res = await listAudiencePolls(
      new Request(audiencePollsUrl(activity.accessCode, "invalid-session-id")),
      routeAccessCode(activity.accessCode)
    );
    expect(res.status).toBe(404);
  });
});
