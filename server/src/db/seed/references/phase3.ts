import type { SeedStepReference } from '../types';

export const phase3References: Record<string, SeedStepReference> = {
  'p3-t1-state-machine/p3-t1-s1': {
    approach: [
      '在 docs/task-state.md 画状态图，箭头标事件名：',
      'queued --START--> running；running 可 --COMPLETE/--FAIL/--PAUSE/--REQUEST_APPROVAL/--CANCEL 去五个不同状态；waiting_approval --APPROVE--> running；paused --RESUME--> running。',
      '「状态机」= 写死的路线图，只能沿箭头走。',
      '终态三个方框不画出边；事件名一律全大写，否则下步查表查不到。',
    ].join('\n'),
    verify: [
      '状态图里 7 个状态全部出现，终态没有任何出边',
      'running 收到 START 这类未定义组合，图上明确没有箭头',
      'docs/task-state.md 已保存，事件名与步骤说明逐字一致',
    ],
  },
  'p3-t1-state-machine/p3-t1-s2': {
    approach: [
      '步骤说明的 src/lib/task-state.ts 已能跑，只看三处：rules 用 Partial 表示「这个状态没有这个事件」，查不到即 undefined；终态写成 succeeded: {}，任何事件自然抛错；把 throw 换成带 from 与 event 的 InvalidTransitionError。',
      '别为方便测试给 failed 加 RESUME —— 那正是「失败后不可重启」的验收点。',
      '改完跑 npx tsc --noEmit。',
    ].join('\n'),
    commands: ['npx tsc --noEmit'],
    verify: [
      'npx tsc --noEmit 没有报错',
      '非法事件抛出的错误对象里能看到 from 与 event',
      'rules 里 succeeded / failed / cancelled 三个键都是空对象',
    ],
  },
  'p3-t1-state-machine/p3-t1-s3': {
    approach: [
      '在 src/lib/task-state.test.ts 写两组：遍历 rules（记得 export）断言 11 条合法转换；手写 10 组非法组合，如 expect(() => transition("succeeded", "START")).toThrow()。',
      '「表驱动」= 用例写成数组再循环，不复制十遍 expect。',
      '跑 npx vitest run src/lib/task-state；再做反向验证：临时给 failed 加 RESUME，测试必须变红。',
    ].join('\n'),
    commands: ['npx vitest run src/lib/task-state'],
    verify: [
      '测试文件里能看到遍历 rules 的循环，而不是硬编码 11 条',
      'npx vitest run src/lib/task-state 全绿',
      '临时给 failed 加 RESUME 后测试失败，改回后重新全绿',
    ],
  },
  'p3-t1-state-machine/p3-t1-s4': {
    approach: [
      '把 transition 包成 applyTransition：先算 next，再用一条 findOneAndUpdate({ runId, status: run.status }, { $set: { status: next }, $push: { history } }) 落库。',
      '条件里的 status 就是「乐观锁」：不锁行，只在写入时核对状态没被别人改过，返回 null 就抛 Conflict。',
      'history 只能 $push；actor 从会话取，reason 从参数取。产物：task-state.ts 与 runs.ts 的 runSchema。',
    ].join('\n'),
    verify: [
      '并发两次发同一事件，只有一次成功，另一次拿到 Conflict',
      'db.agentruns.findOne({ runId }) 的 history 顺序与实际一致，每条都有 actor 与 reason',
      '对已 succeeded 的 run 再发 START，报错且 history 长度不变',
    ],
  },
  'p3-t2-persist-runs/p3-t2-s1': {
    approach: [
      '先在 docs/data-model.md 写字段表。Run：runId、taskType、status、input、idempotencyKey、startedAt、finishedAt、error、tokenUsage；Step：runId、index、type、name、status、input、output、durationMs。',
      '「任务定义 vs 执行实例」像菜谱与这锅菜：taskType 是菜谱名，同一 taskType 可以有无数 runId 不同的执行。',
      '两套 status 别混：Run 用那 7 个状态，Step 只有 running/ok/error。',
    ].join('\n'),
    verify: [
      'docs/data-model.md 里每个字段都写了类型与是否必填',
      'AgentRun.status 的枚举与阶段三状态机完全一致',
      '表下面举了同一个 taskType 两个不同 runId 的例子',
    ],
  },
  'p3-t2-persist-runs/p3-t2-s2': {
    approach: [
      '在说明里的 runs.ts 补 runSchema 与写入函数：runId 加 unique；idempotencyKey 用 { unique: true, sparse: true }（sparse = 没这个字段的文档不参与唯一检查，否则 null 互相冲突）；{ runId: 1, index: 1 } 建复合唯一索引。',
      '启动时 await syncIndexes()，再用 db.agentsteps.getIndexes() 确认索引真存在。',
      'appendStep 用 insertOne，重复 index 就该报 E11000。',
    ].join('\n'),
    verify: [
      'db.agentsteps.getIndexes() 里 (runId, index) 唯一索引存在',
      '同一 runId 连写两次 index=1，第二次报 E11000',
      '两条都不带 idempotencyKey 的 run 能同时插入成功',
    ],
  },
  'p3-t2-persist-runs/p3-t2-s3': {
    approach: [
      '循环里维护 let index = 0：调用前 appendStep({ status: "running", input }) 并记 t0；调用后 updateOne 写 output 与 durationMs；catch 里先写 status "error" 再 throw，否则「异常也有记录」过不了。',
      'index 只能用内存变量递增；用 countDocuments 算会在并发下撞唯一索引。',
      '产物：改你自己的循环文件，例如 src/lib/agent-loop.ts。',
    ].join('\n'),
    verify: [
      'db.agentsteps.find({ runId }).sort({ index: 1 }) 的 index 是 0,1,2… 连续',
      '每条 step 的 durationMs 大于 0',
      '故意让工具抛错，库里仍有一条 status:"error" 的步骤，run 最终是 failed',
    ],
  },
  'p3-t2-persist-runs/p3-t2-s4': {
    approach: [
      'Fastify 里加 GET /api/runs/:runId：AgentRun.findOne({ runId })，为空直接 reply.code(404)；再 AgentStep.find({ runId }).sort({ index: 1 })，返回 { run, steps }。',
      '易错：URL 参数与库字段都叫 runId，但是两回事，用前者去匹配后者。',
      '用 curl -i 访问 http://127.0.0.1:8787/api/runs/ 拼真实 runId，正常 200、乱填 404 都试一遍。',
    ].join('\n'),
    commands: ['curl -i "http://127.0.0.1:8787/api/runs/<填写真实runId>"'],
    verify: [
      '正常 runId 返回 200，steps 按 index 升序',
      '不存在的 runId 返回 404，body 里有 error 字段',
      '用 curl -i 能看到状态码，而不是只在浏览器页面里看',
    ],
  },
  'p3-t3-resume-idempotency/p3-t3-s1': {
    approach: [
      '「检查点」= 游戏存档：记下已经安全走完第几步。',
      'Run 加 lastCompletedStep（初始 -1）与 stepState（只存恢复要用的少量上下文）；每步成功后用一条 findOneAndUpdate 同时推进检查点并追加 history。',
      'resume 时 index 小于等于 lastCompletedStep 的步骤直接读 step.output，不重调模型或工具。',
      '别把整段 messages 塞进 stepState；产物在 src/lib/runs.ts 与 src/lib/resume.ts。',
    ].join('\n'),
    verify: [
      'lastCompletedStep 等于 status:"ok" 步骤的最大 index，而不是步骤总数',
      '手动把 lastCompletedStep 减 1 再 resume，只重跑那一步',
      'stepState 里没有整段消息历史',
    ],
  },
  'p3-t3-resume-idempotency/p3-t3-s2': {
    approach: [
      '「幂等」= 同一请求来多少次，副作用只发生一次。靠唯一索引抢，不靠先查后插 —— 并发下两个请求都会查到空。',
      '顺序：crypto.randomUUID() 先生成 runId → claim(key, runId) → claimed:true 才 createRun 并执行。',
      '先 await Key.syncIndexes()，用 db.idempotencykeys.getIndexes() 确认 key 唯一；TTL 索引由后台每分钟扫，别断言 7 天后立刻消失。',
    ].join('\n'),
    verify: [
      'db.idempotencykeys.getIndexes() 里有 key 的唯一索引',
      '5 个并发请求只有 1 个 claimed:true，其余返回同一个 runId',
      '换一个 key 能创建新的 run',
    ],
  },
  'p3-t3-resume-idempotency/p3-t3-s3': {
    approach: [
      '循环里加：index === Number(process.env.CRASH_AFTER_STEP) 时 process.exit(1)，放在调工具之前。',
      '先 CRASH_AFTER_STEP=2 npx tsx src/scripts/run-demo.ts，再 npx tsx src/scripts/resume.ts <runId>；PowerShell 得先 $env:CRASH_AFTER_STEP="2"。',
      '在 mock 工具里打 console.log("SIDE_EFFECT", name) 数次数；卡住先看 lastCompletedStep 是否等于 2。',
    ].join('\n'),
    commands: [
      'CRASH_AFTER_STEP=2 npx tsx src/scripts/run-demo.ts',
      'npx tsx src/scripts/resume.ts <runId>',
    ],
    verify: [
      '崩溃后 db.agentsteps 最后一条是 index:2 且 status:"ok"',
      'resume 后总步骤数与正常跑一次相同',
      'SIDE_EFFECT 日志里每个动作只出现一次',
    ],
  },
  'p3-t4-retry-timeout/p3-t4-s1': {
    approach: [
      '在 docs/retry-policy.md 写三列表：错误 / 是否重试 / 理由。',
      '可重试：429、502/503/504、超时（AbortError、ETIMEDOUT）、ECONNRESET；不重试：400、401/403、404、业务校验失败；需人工：风控拦截、审批被拒。',
      '「可重试」只看 error.status 与 code，别用 message.includes("timeout")；未知错误默认不重试。',
    ].join('\n'),
    verify: [
      'docs/retry-policy.md 至少覆盖 429 / 5xx / 超时 / 401 / 400 五类',
      'isRetryable 对 401 返回 false，对 503 返回 true',
      '代码里没有用 message 文本判断是否重试',
    ],
  },
  'p3-t4-retry-timeout/p3-t4-s2': {
    approach: [
      '「指数退避」= 0.5 秒、1 秒、2 秒越等越久；「抖动」= 加一点随机，避免所有客户端同一秒一起重试。',
      '把说明里的 500 与 8000 抽成 { retries, baseMs, maxMs }，测试传 baseMs:1 才能秒跑；每次重试打一行 attempt、status、delay。',
      'attempt 从 0 起、条件 <= retries，所以 retries:3 共调用 4 次，下一步断言 4 就是这个原因。',
    ].join('\n'),
    verify: [
      '传 baseMs:1 跑测试，日志里的 delay 依次约 1、2、4 毫秒',
      '每次重试日志都有原因与等待毫秒数',
      '传 retries:0 时只调用 1 次',
    ],
  },
  'p3-t4-retry-timeout/p3-t4-s3': {
    approach: [
      '熔断器像空气开关：连续 5 次失败就 open（直接抛 CircuitOpenError，请求根本不发），30 秒后 half_open 只放 1 个请求试探，成功回 closed、失败回 open。',
      '失败时计数、成功清零；半开要用 flag 挡住并发，否则一起涌进去。只统计网络错误与 5xx，401 不该打开开关。',
      '把状态暴露到 GET /api/health 的 breaker 字段；产物 src/lib/circuit-breaker.ts。',
    ].join('\n'),
    verify: [
      '连续 mock 失败 5 次后第 6 次立即抛错，耗时应接近 0',
      '等 30 秒后放行一次，成功一次后状态回到 closed',
      '/api/health 或日志里能看到当前熔断状态',
    ],
  },
  'p3-t4-retry-timeout/p3-t4-s4': {
    approach: [
      '用 vi.fn 造假函数即可，不必真发请求：',
      '~~~typescript',
      'const fn = vi.fn().mockRejectedValue(Object.assign(new Error("no"), { status: 401 }));',
      'await expect(withRetry(fn, 3)).rejects.toThrow();',
      'expect(fn).toHaveBeenCalledTimes(1);',
      '~~~',
      '503 同理但断言 4 次，两个数字不同才是关键。传 baseMs:1，否则退避要真等 3.5 秒。',
    ].join('\n'),
    verify: [
      '401 用例断言调用 1 次，503 用例断言调用 4 次',
      'npx vitest run src/lib/retry 全绿',
      '把 isRetryable 改成恒返回 true，401 用例变红，改回后再全绿',
    ],
  },
  'p3-t5-approval/p3-t5-s1': {
    approach: [
      '给 ToolDefinition 加必填 risk: "readOnly" | "mutating" | "destructive"，联合类型让漏填直接编译报错。',
      '「权限元数据」= 工具自己带的标签：策略层读标签决定放行、审批还是拒绝，而不是看工具名里有没有 refund 这种字符串。',
      '注册表启动时遍历校验，未知等级直接 throw；别为了流程顺把写工具标成 readOnly。',
    ].join('\n'),
    verify: [
      '启动日志打印工具清单，每个工具都有 risk',
      '把某个工具的 risk 改成 "unknown"，服务启动失败并打印工具名',
      'readOnly / mutating / destructive 各有至少一个工具',
    ],
  },
  'p3-t5-approval/p3-t5-s2': {
    approach: [
      '写工具执行前「先落库再暂停」：算 argsHash（键排序后 sha256），建 Approval { runId, toolName, argsHash, args, status: "pending", expiresAt: 15 分钟后 }，再把 run 推到 waiting_approval 并 return。',
      'args 存完整参数给审批人看，argsHash 只用来确认「还是那一单」，两个都要。',
      '产物：src/lib/approvals.ts 加循环里的写工具分支。',
    ].join('\n'),
    verify: [
      '触发写工具后该 run 的 status 是 waiting_approval',
      'db.approvals 里有一条 pending，args 完整，expiresAt 在 15 分钟后',
      '此时 mock 写操作的副作用日志条数为 0',
    ],
  },
  'p3-t5-approval/p3-t5-s3': {
    approach: [
      '批准用一次原子更新，不要先 findOne 再 save：',
      'Approval.findOneAndUpdate({ _id: id, status: "pending", argsHash }, { $set: { status: "approved", decidedBy, decidedAt } })，返回 null 就 reply.code(409)。',
      '执行前再核对 argsHash 与 expiresAt；把 argsHash 从条件里删掉，审批就形同虚设。',
    ].join('\n'),
    verify: [
      '连续两次 decide，第二次返回 409',
      '改动参数重新算 hash 后，旧审批不能用于执行',
      '把 expiresAt 改成过去时间，decide 返回 409 且状态变 expired',
    ],
  },
  'p3-t5-approval/p3-t5-s4': {
    approach: [
      '先 curl 再写界面：GET /api/approvals?status=pending 返回待办；POST /api/approvals/:id/decide 的 body 是 { decision, reason }，decidedBy 从会话取，不从 body 取。',
      '批准：更新审批 → applyTransition(APPROVE) → 继续该步；拒绝：run 走 CANCEL 并记 reason。',
      '操作后重新拉列表，不做本地乐观更新；JSON body 写进文件用 -d @body.json。',
    ].join('\n'),
    commands: ['curl "http://127.0.0.1:8787/api/approvals?status=pending"'],
    verify: [
      '界面上能看到 pending 审批，包含订单号与金额',
      '批准后 run 回到 running 并最终 succeeded',
      '拒绝后 run 变 cancelled，history 里有拒绝原因',
      '重复点批准，界面显示冲突提示',
    ],
  },
  'p3-t6-background-queue/p3-t6-s1': {
    approach: [
      'POST /api/runs 只做三件：校验 → createRun(status: "queued") → reply.code(202).send({ runId })，不要 await 模型。',
      'worker 每 500ms 用 findOneAndUpdate 把一条 queued 改成 running（sort createdAt、new: true）来领取，返回 null 就等下一轮 —— 原子领取才不会有两人拿到同一条。',
      '「队列」在这里就是数据库里一个 status 字段，不需要 Redis。',
    ].join('\n'),
    verify: [
      'POST 返回 202，body 只有 runId，耗时小于 200ms',
      'worker 启动后 1 秒内该 run 从 queued 变 running',
      '手动把一条 run 置回 queued，worker 能再次领取',
    ],
  },
  'p3-t6-background-queue/p3-t6-s2': {
    approach: [
      'worker 维护 let active = 0：领取前 if (active >= 2) 就等下一轮，finally 里减 1。',
      '「心跳」= 活着就定期报到：每 10 秒 updateOne 写 heartbeatAt；早于 now 减 60 秒且 status 是 running 即 stale，列到 GET /api/runs?stale=1。',
      '心跳定时器必须在 finally 里 clearInterval，否则任务结束后还在写库。',
    ].join('\n'),
    verify: [
      '同时提交 5 个任务，任意时刻 status:"running" 数量不超过 2',
      '运行中的 run，heartbeatAt 与当前时间差小于 15 秒',
      'kill 掉 worker 60 秒后，该 run 出现在 stale 列表',
    ],
  },
  'p3-t6-background-queue/p3-t6-s3': {
    approach: [
      '「优雅停机」= 不再接新活，把手上的活停在安全点再退出。',
      '监听 SIGTERM 与 SIGINT（Windows 本地 Ctrl+C 发的是 SIGINT），置 shuttingDown；循环在写完检查点后看到就停，把 run 置回 queued 并保存 lastCompletedStep；再 setTimeout(10_000) 兜底 exit(1)。',
      'docker stop 后日志里应有「检查点已保存」，重启从下一步继续。',
    ].join('\n'),
    verify: [
      'Ctrl+C 或 docker stop 后日志出现「检查点已保存」',
      '重启后该 run 的步骤 index 没有重复',
      '停机过程中日志里没有新的 run 开始',
    ],
  },
  'p3-t7-acceptance/p3-t7-s1': {
    approach: [
      '把演示做成可重放脚本：demo/tasks/refund-request.ts 定义 read_policy → get_order_status → issue_refund → record_result。',
      '只读工具读 demo/data 下的 JSON；issue_refund 只往 demo/side-effects.log 追加一行，不接真实资金系统。',
      'demo/run-refund.ts 支持 --crash-after 与 --idempotency-key 并打印 runId；先正常跑通四步，再上崩溃与重复提交。',
    ].join('\n'),
    verify: [
      'demo/run-refund.ts 一次跑完能看到 4 条 step 记录',
      'side-effects.log 只在批准后出现一行 issue_refund',
      '脚本能接收 --crash-after 与 --idempotency-key',
    ],
  },
  'p3-t7-acceptance/p3-t7-s2': {
    approach: [
      '四条路径依次跑，每条都把结果写进 docs/phase3-evidence.md：',
      '正常 npx tsx demo/run-refund.ts；崩溃加 --crash-after=2 再 npx tsx demo/resume.ts <runId>；重复提交用同一 --idempotency-key 跑两次；拒绝审批把状态改 rejected。',
      '每条留 runId、run 的 status 与 history、按 index 排序的 steps；贴 JSON 比截图有用，没跑通就把错误原文一起贴。',
    ].join('\n'),
    commands: [
      'npx tsx demo/run-refund.ts',
      'npx tsx demo/run-refund.ts --crash-after=2',
      'npx tsx demo/resume.ts <runId>',
    ],
    verify: [
      '四条路径在证据文件里都有 runId 与真实 JSON 片段',
      '崩溃路径最终 status 是 succeeded，重复提交路径只有一条 run',
      '拒绝路径的 side-effects.log 没有新增行',
    ],
  },
  'p3-t7-acceptance/p3-t7-s3': {
    approach: [
      '在阶段验收新建记录，正文四段：证据索引（场景、runId、命令、预期与实际）、一条设计取舍（如幂等用唯一索引而非先查后插）、一处失败与修复、遗留项。',
      '命令要能直接复制，runId 要真实存在、复查时还查得到。',
      '保存后回任务列表确认阶段三 7 个任务都是已完成。',
    ].join('\n'),
    verify: [
      '验收记录里有至少 3 个真实 runId，现在仍能查到',
      '写了一个具体失败案例，含原因与修复',
      '阶段三 7 个任务状态都是已完成',
    ],
  },
};
