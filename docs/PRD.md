# 观众提问墙 MVP

## Problem Statement

演讲、分享等展示型活动中，观众通常有问题、共鸣和即时反馈，但现场时间有限，主持账号很难判断哪些观众问题最值得优先回应。传统举手、纸条或聊天流容易丢失上下文，也不适合投屏展示和活动后复盘。

活动需要一个轻量、近实时、适合约 200 个活跃观众会话同时参与的观众提问墙。观众应能快速加入活动、提交观众问题、为自己也关心的问题点赞，并参与主持账号发起的单选投票。主持账号需要在主持控制台中管理活动、问题和投票，展示视图需要把加入入口、问题墙和投票结果稳定地展示给现场观众。

产品建模的是现场互动活动，而不是演讲、会议、议程或完整会议管理系统。

## Solution

构建一个实时网页体验：主持账号创建活动，系统生成访问码和加入链接；观众通过访问码、链接或二维码进入观众视图，并以观众会话参与单个活动。观众会话可以匿名，也可以提供显示名。

活动按草稿活动、进行中活动、已结束活动单向流转。草稿活动用于准备，不接受观众互动；进行中活动接受观众问题、问题点赞和投票选择；已结束活动保持只读访问，但不能重新开启。重复场次或后续场次必须创建新的活动。

观众视图让观众提交观众问题、点赞可见且未回答的问题、参与进行中投票，并立即获得观众乐观反馈。主持控制台让主持账号创建活动、控制活动生命周期、置顶问题、标记已回答问题、隐藏问题、创建和关闭投票、调整投票排序、查看投票结果、导出活动数据并软删除活动。展示视图由主持账号打开并投屏，是主持账号在演示现场的操作界面，观众消费投屏内容。展示视图组合展示加入信息、排序后的问题墙、置顶问题和投票结果，并支持主持账号直接进行置顶/取消置顶、标记回答、隐藏问题和关闭投票等控场操作。展示视图与主持控制台职责边界明确：展示视图侧重投屏现场的轻量控场，主持控制台侧重完整的活动管理和数据查看。

各视图应支持近实时更新：活动更新通常在 1-2 秒内出现在观众视图、展示视图和主持控制台中，且不需要用户手动刷新页面。实现方式不在产品模型中承诺为长连接、轮询或其他具体机制。

## User Stories

### 主持账号 - 活动管理

1. As a 主持账号, I want to create an 活动, so that I can prepare a 观众提问墙 for a live 演讲.
2. As a 主持账号, I want each 活动 to receive a generated 访问码, so that 观众 can join without needing an account.
3. As a 主持账号, I want to view 活动 that I own, so that I can manage multiple presentations from one 主持控制台.
4. As a 主持账号, I want to keep a new 活动 as a 草稿活动, so that I can prepare it before accepting 观众 interaction.
5. As a 主持账号, I want to start a 草稿活动, so that it becomes a 进行中活动 and begins accepting 观众问题, 问题点赞, and 投票选择.
6. As a 主持账号, I want to end a 进行中活动, so that it stops accepting new interaction when the 演讲 is over.
7. As a 主持账号, I want 已结束活动 to stay read-only, so that the activity record remains reviewable after the live moment.
8. As a 主持账号, I want 已结束活动 to be impossible to reopen, so that the timeline of 观众问题 and 投票 remains trustworthy.
9. As a 主持账号, I want to create a new 活动 for a repeated 演讲, so that the new audience interaction is separated from the previous timeline.
10. As a 主持账号, I want to soft delete an 活动, so that it disappears from my default 主持控制台 list and is no longer publicly accessible.

### 观众 - 加入与身份

11. As a 观众, I want to join an 活动 through a 访问码, so that I can participate without installing software.
12. As a 观众, I want to join an 活动 through a direct link, so that I can enter from a shared entry point or QR code.
13. As a 观众, I want to enter anonymously, so that I can ask a question without providing a name.
14. As a 观众, I want to provide an optional 显示名, so that my 观众问题 can carry useful context without becoming a verified identity.
15. As a 观众, I want my 观众会话 to stay in the same browser for the 活动, so that my display name, question likes, and poll choices remain consistent.
16. As a 观众, I want to see that a 草稿活动 is not yet accepting interaction, so that I understand why I cannot submit questions or poll choices.

### 观众 - 问题互动

17. As a 观众, I want to submit a 观众问题 during a 进行中活动, so that the 主持账号 can consider answering it.
18. As a 观众, I want the 问题字数限制 to be clear before submitting, so that I can keep my question within the allowed length.
19. As a 观众, I want submitted 观众问题 to be immutable, so that the activity timeline stays reliable.
20. As a 观众, I want to receive 观众乐观反馈 after submitting a question, so that I know my action was registered immediately.
21. As a 观众, I want service-side confirmation to remain authoritative, so that stale or invalid local actions do not corrupt the 活动 state.
22. As a 观众, I want to see visible and unanswered 观众问题, so that I can understand what others are asking.
23. As a 观众, I want 置顶问题 to appear before normally sorted questions, so that I can see what the 主持账号 has prioritized.
24. As a 观众, I want non-pinned questions to use 问题排序, so that the most supported questions are easiest to notice.
25. As a 观众, I want questions with equal likes to be ordered by submission time, so that ties behave predictably.
26. As a 观众, I want 已回答问题 to leave the main question list, so that the visible wall stays focused on pending questions.
27. As a 观众, I want 隐藏问题 to disappear from 观众视图, so that unsafe or off-topic content is not shown.
28. As a 观众, I want to add a 问题点赞 to a question I also care about, so that the 主持账号 can see shared interest.
29. As a 观众, I want my 观众会话 to contribute at most one like per question, so that 问题点赞 reflects audience breadth rather than repeated clicking.

### 观众 - 投票与活动结束

30. As a 观众, I want to participate in a 进行中投票, so that I can respond to a structured question from the 主持账号.
31. As a 观众, I want each 单选投票 to allow one selected 投票选项, so that my 投票选择 is unambiguous.
32. As a 观众, I want to change my 投票选择 before the 投票 closes, so that I can correct a mistake or update my answer.
33. As a 观众, I want the 观众视图 to show my own 投票选择, so that I know what I selected.
34. As a 观众, I do not want the 观众视图 to show aggregate 投票结果, so that live responses are not biased by public totals.
35. As a 观众, I want the 观众视图 to stop accepting interaction after the 活动 ends, so that I do not accidentally submit to a closed event.
36. As a 观众, I want an 已结束活动 to remain viewable through its 访问码 in read-only mode, so that I can review what happened.
37. As a 观众, I want an 已删除活动 to be inaccessible through 观众视图, so that removed activity content is not publicly available.

### 主持账号 - 问题管理

38. As a 主持账号, I want to view incoming 观众问题 in the 主持控制台, so that I can manage the live question flow.
39. As a 主持账号, I want to pin a 观众问题, so that it appears before normal 问题排序 in 观众视图 and 展示视图.
40. As a 主持账号, I want to unpin a 置顶问题, so that it returns to normal ordering.
41. As a 主持账号, I want to mark a 观众问题 as an 已回答问题, so that it leaves the main visible question list.
42. As a 主持账号, I want to mark an 已回答问题 as not answered, so that it can return to the pending question flow.
43. As a 主持账号, I want to hide a 观众问题, so that I can remove low-quality or inappropriate content from public views.
44. As a 主持账号, I want hidden content to be treated as a low-frequency safety control, so that the product stays focused on lightweight live interaction.
45. As a 主持账号, I want to use the 主持控制台 during a 演讲, so that I can choose which audience questions to answer.
46. As a 主持账号, I want to see which 观众问题 have the most 问题点赞, so that I can focus on shared audience interest.

### 主持账号 - 投票管理

47. As a 主持账号, I want to create a 单选投票, so that I can ask a structured question during the 演讲.
48. As a 主持账号, I want to create multiple 进行中投票 in one 活动, so that I can run more than one structured interaction when needed.
49. As a 主持账号, I want new 投票 to appear first by default, so that the latest interaction is prominent.
50. As a 主持账号, I want to adjust 投票排序, so that 观众视图 and 展示视图 show polls in the intended order.
51. As a 主持账号, I want to edit a 投票 before it receives any 投票选择, so that I can correct wording or options.
52. As a 主持账号, I want to delete a 投票 before it receives any 投票选择, so that unused mistakes can be removed cleanly.
53. As a 主持账号, I want a 投票 that has received 投票选择 to become non-editable and non-deletable, so that results remain trustworthy.
54. As a 主持账号, I want to close a 投票, so that it no longer accepts 投票选择 but can still show results.
55. As a 主持账号, I want to see 投票结果 as both percentages and raw counts, so that I can interpret live response volume accurately.
56. As a 主持账号, I want 主持控制台 updates to arrive without manual refresh, so that I can manage the 活动 during the live moment.
57. As a 主持账号, I want to export 活动 data as CSV, so that I can review 观众问题, 问题点赞, 投票, 投票选项, and 投票结果 after the 演讲.
58. As a 主持账号, I want to see 投票结果 in the 主持控制台, so that I can adapt the 演讲 based on audience responses.

### 现场观众 - 展示视图

59. As a 现场观众, I want 展示视图 to show joining information with 访问码 and QR code, so that additional 观众 can join during the 演讲.
60. As a 现场观众, I want 展示视图 to show visible and unanswered 观众问题 in 问题排序, so that the audience can follow the most relevant questions.
61. As a 现场观众, I want 展示视图 to give 置顶问题 visual emphasis, so that the audience can track what the 主持账号 has prioritized.
62. As a 现场观众, I want 展示视图 to exclude hidden and answered questions from the main wall, so that the projected view stays clear.
63. As a 现场观众, I want 展示视图 to show 投票结果 as percentages, so that the audience can understand aggregate responses without needing raw counts.
64. As a 现场观众, I want 展示视图 updates to appear within 1-2 seconds, so that the projected content feels live.

### 主持账号 - 展示视图控场

65. As a 主持账号, I want to pin or unpin a 观众问题 directly from 展示视图, so that I can manage the spotlight without leaving the projected view.
66. As a 主持账号, I want to mark a 观众问题 as answered directly from 展示视图, so that I can clean the wall on the fly during the 演讲.
67. As a 主持账号, I want to hide a 观众问题 directly from 展示视图, so that I can remove inappropriate content immediately.
68. As a 主持账号, I want to close a 投票 directly from 展示视图, so that I can end a poll without switching to 主持控制台.
69. As a 主持账号, I want the display view to show only the applicable control buttons based on current state, so that the interface does not mislead about available actions.

### 主持账号 - 产品边界与发布约束

70. As a 主持账号, I want to keep the product separate from full 演讲 management, so that the tool stays focused on live interaction.
71. As a 主持账号, I want the first version to target about 200 active 观众会话 per 活动, so that scope and implementation choices fit the expected live usage.
72. As a 主持账号, I want the first version to use only a few example 主持账号 if needed, so that account management does not distract from the core live interaction.
73. As a 主持账号, I want the UI to be allowed to ship in Chinese first, so that the MVP can focus on core behavior before full internationalization.
74. As a 主持账号, I want not to commit to a specific near-real-time transport in the product model, so that implementation can choose the simplest reliable mechanism.
75. As a 主持账号, I want deleted 活动 data to be retainable, so that soft deletion does not imply permanent data destruction.

## Implementation Decisions

- The product centers on 活动. 演讲 is context for the live situation, not a managed product object.
- 活动 belongs to exactly one 主持账号 in the MVP. Shared ownership, teams, organizations, and invitation flows are out of scope.
- The MVP may use a small set of example 主持账号 instead of a complete account management system.
- 活动 has a title, lifecycle state, generated 访问码, creation time, owner 主持账号, and 问题字数限制. The default 问题字数限制 is 240 characters.
- 活动 lifecycle is one-way: 草稿活动 can become 进行中活动; 进行中活动 can become 已结束活动; 已结束活动 cannot become 进行中活动 again.
- The one-way lifecycle follows the existing ADR: 已结束活动不可重新开启 because reusing an activity would make the question and poll timeline untrustworthy.
- 已结束活动 remains accessible through 访问码 as read-only. It accepts no new 观众问题, 问题点赞, or 投票选择.
- 已删除活动 is a soft-deleted state or flag. It is hidden from the default 主持控制台 list and cannot be accessed through 观众视图 or 展示视图, while retained data may continue to exist.
- 访问码 is generated by the system and is the primary short entry path for 观众. Direct links and QR codes can resolve to the same join flow.
- 观众会话 is scoped to one 活动 and one browser. It stores the optional 显示名, question-like state, and 投票选择 for that activity.
- 显示名 is optional and not a verified identity. Anonymous entry is allowed.
- 观众问题 is plain text submitted by a 观众会话. After submission, the 观众 cannot edit or delete it.
- 观众问题 submission is allowed only for 进行中活动 and only within the activity's 问题字数限制.
- Public question lists show visible and unanswered 观众问题. 已回答问题 and 隐藏问题 are excluded from the main 观众视图 and 展示视图 lists.
- 置顶问题 appears before normal 问题排序. When a pinned question is unpinned, it returns to normal sorting.
- Normal 问题排序 uses 问题点赞 count descending, then submission time ascending.
- 问题点赞 expresses that a 观众会话 also cares about a 观众问题. It is not a rating, score, or 投票选择.
- Each 观众会话 can contribute at most one 问题点赞 to a given 观众问题.
- Like cancellation may exist, but it is not a first-version priority.
- 隐藏问题 is a low-priority moderation control for the first version. The product does not require pre-publication review before questions appear.
- 投票 is a structured question created by a 主持账号 from the 主持控制台.
- The MVP supports 单选投票 only. Each 观众会话 can select one 投票选项 per 投票.
- A 观众会话 can modify its 投票选择 until the 投票 is closed.
- An 活动 can have multiple 进行中投票, and the product does not impose a product-level limit on the number of polls per activity.
- 投票排序 is controlled from 主持控制台 and is shared by 观众视图 and 展示视图. Newly created polls appear first by default.
- A 投票 may be edited or deleted only before it receives any 投票选择.
- After a 投票 receives at least one 投票选择, it can be closed but cannot have its prompt or 投票选项 changed and cannot be deleted.
- 已关闭投票 accepts no further 投票选择 but can still display 投票结果。关闭投票不要求已有投票选择（允许 0 票关闭）。
- 投票结果 visibility differs by view: 观众视图 shows only the current 观众会话's own 投票选择; 展示视图 shows percentage results; 主持控制台 shows percentages and raw counts.
- 展示视图由主持账号打开并操作，用于现场投屏；观众仅消费投屏内容。展示视图与主持控制台职责边界明确：展示视图侧重投屏现场的轻量控场（置顶/取消置顶、标记回答、隐藏问题、关闭投票），主持控制台侧重完整的活动管理和数据查看。
- 展示视图的直接控场操作限定为四类：置顶/取消置顶观众问题、标记观众问题为已回答、隐藏观众问题、关闭投票。
- 展示视图控场按钮的显示条件固定为：
  - 置顶按钮：`!question.isPinned` 时显示
  - 取消置顶按钮：`question.isPinned` 时显示
  - 标记回答按钮：`!question.isAnswered` 时显示
  - 隐藏按钮：`!question.isHidden` 时显示
  - 关闭投票按钮：`!poll.isClosed` 时显示
- 从展示视图关闭投票不要求投票已有投票选择；允许 0 票关闭，与主持控制台行为一致。

- 活动导出 is a CSV export for post-event review. It includes 观众问题, 问题点赞, 投票, 投票选项, and 投票结果.
- 观众视图, 展示视图, and 主持控制台 should all receive near-real-time updates within 1-2 seconds without manual refresh.
- The product contract requires near-real-time behavior but does not prescribe whether the implementation uses long polling, server-sent events, WebSockets, short polling, or another transport.
- 观众乐观反馈 is allowed for question submission, liking, and poll selection, but server-confirmed activity state remains authoritative.
- The first version is optimized for a single 活动 with about 200 active 观众会话 viewing pages, submitting 观众问题, liking questions, and participating in 投票.
- The first version may ship with Chinese UI and without full internationalization.

## Testing Decisions

- The preferred test seam is the 活动-level user behavior seam: exercise the product through the externally visible behavior of 观众视图, 展示视图, and 主持控制台 against the same 活动, rather than testing implementation details inside individual state updates.
- A good test verifies user-observable outcomes: whether a 观众 can join, whether a submitted 观众问题 appears in the right views, whether 问题排序 changes after 问题点赞, whether 置顶问题 overrides normal ordering, whether 已回答问题 and 隐藏问题 leave public lists, whether 投票选择 changes results, and whether closed or ended states reject interaction.
- Lifecycle tests should cover 草稿活动, 进行中活动, 已结束活动, and 已删除活动 from the perspective of each view. They should verify that 已结束活动 is read-only and cannot be reopened.
- Question tests should cover 问题字数限制, immutable submitted questions, anonymous and display-name submissions, one-like-per-观众会话 behavior, pinned ordering, answered removal, and hidden removal.
- Poll tests should cover 单选投票, changing 投票选择 before close, multiple 进行中投票, 投票排序, edit/delete before any selection, non-editability and non-deletability after receiving a selection, 已关闭投票 behavior, and view-specific 投票结果 visibility.
- Display view moderation tests should cover pinning and unpinning questions, marking questions answered, hiding questions, and closing polls directly from 展示视图. They should verify that control buttons follow the display conditions (`!question.isPinned`, `question.isPinned`, `!question.isAnswered`, `!question.isHidden`, `!poll.isClosed`) and that operations are reflected in 观众视图 and 主持控制台 within the near-real-time window.
- 0-vote close tests should verify that a poll with zero 投票选择 can be closed from both 展示视图 and 主持控制台, and that the closed poll still displays results correctly.

- Near-real-time tests should verify that updates propagate to 观众视图, 展示视图, and 主持控制台 without manual refresh within the product target window. These tests should assert the visible update behavior, not the transport mechanism.
- Export tests should verify that 活动导出 contains the expected CSV records for 观众问题, 问题点赞, 投票, 投票选项, and 投票结果.
- Scale-oriented tests should model the target activity scale of about 200 active 观众会话 for a single 活动 and verify that the core flows remain usable.
- Since the repository currently contains product documentation and no implementation or test suite, there is no existing in-code prior art for test style. The first implementation should create the highest-level behavior tests first and keep lower-level tests focused on domain rules that are hard to verify through the main 活动 seam.

## Out of Scope

- Modeling 演讲, venue, agenda, speaker biography, or full conference management.
- Full account management, including password reset, teams, organizations, invitations, and shared activity ownership.
- Pre-publication review before 观众问题 appears.
- 观众-side editing or deletion of submitted 观众问题.
- Automatic duplicate-question detection or merging.
- Poll types beyond 单选投票.
- Showing aggregate 投票结果 in 观众视图.
- Full internationalization; the first version may use Chinese UI.
- A product-level commitment to WebSockets, long polling, server-sent events, short polling, or any specific refresh implementation.
- Offline mode or client-authoritative synchronization.
- PDF reports, analytics dashboards, or email delivery.
- Permanent deletion guarantees for 已删除活动 data.
- Managing more than one owner for the same 活动.

## Further Notes

- The domain glossary in the repository is authoritative for naming. Use 活动, 观众会话, 访问码, 观众视图, 展示视图, 主持控制台, 问题点赞, 投票选择, and 活动导出 instead of avoided terms such as room, channel, message, score, report, dashboard, or meeting.
- The ADR “已结束活动不可重新开启” is a hard constraint for this PRD. Any implementation that allows an 已结束活动 to become a 进行中活动 again conflicts with the current project decision.
- The current PRD is ready to be published to the issue tracker with the `ready-for-agent` label once GitHub CLI network access is available.


