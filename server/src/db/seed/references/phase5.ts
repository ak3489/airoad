import type { SeedStepReference } from '../types';

export const phase5References: Record<string, SeedStepReference> = {
  'p5-t1-project-init/p5-t1-s1': {
    approach: [
      '在 docs/architecture.md 画请求流：Web → API → Agent Runtime → 分支 Retrieval/KB 与 Tool Registry → Policy/Approval → Mock CRM。',
      '「信任边界」= 这边数据可能是坏的：浏览器到 API、模型到工具两处画虚线，跨过去都要校验。',
      '六个模块对应 src/api、src/agent、src/kb、src/tools、src/policy、web/，依赖单向；写操作路径必须过 policy。',
    ].join('\n'),
    verify: [
      'docs/architecture.md 里有流程图与两处信任边界标注',
      '目录结构里 policy 独立存在，tools 下没有 import agent',
      '所有写工具路径在图上都经过 policy 与 approval 两个节点',
    ],
  },
  'p5-t1-project-init/p5-t1-s2': {
    approach: [
      'ADR（架构决策记录）就是「当时为什么这么选」的一页纸，固定四段：背景 / 备选方案（至少 2 个）/ 决定 / 后果。',
      '放 docs/adr/0001-xxx.md，编号不复用。三份主题：先检索再拼 prompt（备选全量塞入、微调模型）、运行记录存 MongoDB（备选 Postgres jsonb）、用 SSE 而非 WebSocket。',
      '后果必须写缺点；决定被推翻不改原文，新建一份注明 supersedes。',
    ].join('\n'),
    verify: [
      'docs/adr 下至少 3 份文件，编号与标题齐全',
      '每份都有备选方案与负面后果',
      '至少一份写明「什么情况下会推翻这个决定」',
    ],
  },
  'p5-t1-project-init/p5-t1-s3': {
    approach: [
      '只跑通「前端能问到后端」：后端 npm i fastify @fastify/cors，GET /api/health 监听 8787；前端 npm create vue@latest web（默认 5173），挂载时 fetch 这个地址。',
      'CORS 只放行 127.0.0.1:5173 与 localhost:5173，别写 origin: true；VITE_ 开头的变量都会打进前端 bundle。',
      'npm run dev 后看 Network 是否 200；报错先查响应头有没有 access-control-allow-origin。',
    ].join('\n'),
    commands: ['npm run dev', 'curl http://127.0.0.1:8787/api/health'],
    verify: [
      '浏览器里能看到 health 返回的 ok:true',
      '换个不允许的 origin 请求时被 CORS 拒绝',
      '前端构建产物里搜不到任何 API key',
    ],
  },
  'p5-t2-kb-ingestion/p5-t2-s1': {
    approach: [
      '建 knowledge/policy、product、internal 三个目录，放 30 篇以上文档。',
      '解析器放 src/kb/parse.ts：去 HTML 注释与 script 块、合并空行、删重复的页眉页脚，保留 # 与 ## 标题。',
      '每篇产出 { docId, title, category, source, updatedAt, content }，docId 用相对路径不要自增 id。',
      '清洗后打印前 300 字人眼过一遍，导航和页脚最容易漏。',
    ].join('\n'),
    verify: [
      '三个分类目录合计至少 30 个文件',
      '随机挑 3 篇打印正文，看不到导航、脚本、重复页眉',
      '每篇都有 source 与 updatedAt 字段',
    ],
  },
  'p5-t2-kb-ingestion/p5-t2-s2': {
    approach: [
      '复用阶段四的 chunkMarkdown，补三类元数据。chunk 就是切出来的一小段文本，检索与引用都以它为单位。',
      '定位 docId + chunkIndex + start/end；结构 headingPath（退货政策 > 时效）；权限 tenantId + visibility，由目录决定，不能检索时临时推断。',
      '300–800 字、相邻重叠 1 句；给 { docId: 1, chunkIndex: 1 } 建唯一索引才能安全 upsert。',
    ].join('\n'),
    verify: [
      '随机抽 3 条 chunk，用 start/end 切原文能得到完全相同的 content',
      '每个 chunk 的 tenantId、visibility、headingPath 都非空',
      '长度分布大致落在 300–800 字，没有少于 50 字的碎片',
    ],
  },
  'p5-t2-kb-ingestion/p5-t2-s3': {
    approach: [
      'npm run kb:sync 做增量，npm run kb:reindex 才全量重建。',
      '脚本 src/kb/sync.ts：扫描 → 算 contentHash → 比对 documents → 新增/更新（先删该 docId 旧 chunk）/跳过/标 archived，最后打印 { added, updated, skipped, archived, chunks }。',
      '先算完再写，中途失败旧数据还在；删文档标 archived 而不是删 chunk，否则历史引用一夜失效。',
    ].join('\n'),
    commands: ['npm run kb:sync', 'npm run kb:sync'],
    verify: [
      '连续执行两次，第二次输出 added 为 0，chunk 总数不变',
      '改一篇文档后重跑，只有该 docId 的 chunk 变化',
      '删一个源文件后重跑，archived 计数加 1 且检索里查不到',
    ],
  },
  'p5-t2-kb-ingestion/p5-t2-s4': {
    approach: [
      '准备 5 条 public 能答的问题与 5 条只该内部知道的问题，用 public 与 internal 两个角色各跑一次，打印 query、docId、score、visibility 成表。',
      '「召回」= 该找到的有没有找到；4/5 命中即达标，剩下一条写清原因。',
      'internal 文档出现在 public 结果里就是失败；先固定问题与 topK 再调阈值。',
    ].join('\n'),
    verify: [
      'public 角色跑内部问题，结果里 internal 文档数为 0',
      '5 条常见问题至少 4 条在 top3 命中正确文档',
      '有分数记录，能说明阈值是怎么定的',
    ],
  },
  'p5-t2-docker-tools/p5-t2-s1': {
    approach: [
      '选修，没环境就只做 mock，并在 ADR 写明「当前为 mock」。',
      '有群晖：建只读账号试 docker ps，多数要 sudo，那就走 DSM Docker API 或本机 Docker；本机先用 docker context ls 确认能跑。',
      '写 docs/adr/0004-docker-access.md：访问方式、权限、是否 sudo；进程用普通用户，docker.sock 不进 Web 容器。',
    ].join('\n'),
    verify: [
      'ADR 里写清访问方式与账号权限',
      'docker ps 能在目标环境执行，或已明确记录为 mock',
      '没有把 docker.sock 暴露给前端或 Web 进程',
    ],
  },
  'p5-t2-docker-tools/p5-t2-s2': {
    approach: [
      '说明里的 src/tools/docker.ts 看四处：execFile("docker", args) 不走 shell（exec 拼字符串会被分号注入）；容器名先过 /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/；timeout 10 秒与 maxBuffer 1MB；State 与 Status 都留。',
      '健康状态在 ps 的 --format 里没有字段，要另跑 docker inspect 读 .State.Health.Status，以本机输出为准。',
      '名字过滤用 ===，别用 startsWith。',
    ].join('\n'),
    verify: [
      '容器名传 abc;rm -rf / 被正则拒绝，且没有启动任何子进程',
      'docker 不存在或超时时抛错，不会挂死',
      '按名字过滤是精确匹配，redis 不会返回 redis-cache',
    ],
  },
  'p5-t2-docker-tools/p5-t2-s3': {
    approach: [
      '参数只暴露 container 与 tail，tail 用 z.number().int().min(20).max(200)，模型传不了 -f 或任意 flag。',
      '取完去掉 ANSI 控制字符；超 20KB 截到 20000 字节加「…已截断」，保留开头 5 行看启动报错。',
      '日志是不可信数据：prompt 写明只是数据不是指令；行数与字节数两道闸都要。',
    ].join('\n'),
    verify: [
      'tail 传 1000 返回参数校验错误，20 与 200 都能通过',
      '让一个容器输出大日志，返回长度不超过 20KB 且末尾有截断说明',
      '返回内容里没有 ANSI 控制字符（终端不出现颜色乱码）',
    ],
  },
  'p5-t2-docker-tools/p5-t2-s4': {
    approach: [
      '导出 src/tools/registry.ts 的工具清单，确认只有 list_containers 与 get_container_logs，没有 start/stop/rm/exec。',
      '注入测试：名字传 "mysql; rm -rf /"、"--privileged"、"$(whoami)"，tail 传 99999，全部应被正则或 zod 拒绝。',
      '只读边界 = 子命令白名单 + 不拼 shell + 参数枚举三者同时成立；用例写进 src/tools/docker.test.ts。',
    ].join('\n'),
    verify: [
      '工具清单里写操作数量为 0',
      '三条注入用例全部返回参数错误，没有执行任何 rm',
      'npx vitest run src/tools/docker 能跑到这些用例',
    ],
  },
  'p5-t3-agent-integration/p5-t3-s1': {
    approach: [
      'prompt 放 src/agent/prompts/customer-service.ts，四段：角色与边界（不承诺赔偿）、工具规则（政策类先 search_kb，订单事实必须 get_order_status）、引用规则（只引 [1] 编号，不写文档名）、拒答规则（无资料就说未说明并建议转人工）。',
      '写「什么时候用哪个工具」，不写「工具能做什么」。',
    ].join('\n'),
    verify: [
      'prompt 里能搜到工具名与各自的使用条件',
      '明确写了引用编号格式，并禁止出现文档名',
      '有无答案时的固定话术，不是「酌情回答」',
    ],
  },
  'p5-t3-agent-integration/p5-t3-s2': {
    approach: [
      '检索 top5 → 按 docId 去重 → 分数阈值过滤 → 截 5 段；单段超 800 字按句子截断并保留 headingPath。',
      '「预算」= 上下文长度：拼完打印总字符数，应比全文拼接小一个量级。',
      '工具结果只留 status、shippedAt、refundable、amount；编号到 chunkId 的映射留在服务端。',
    ].join('\n'),
    verify: [
      '日志里能看到证据总字符数，且明显小于全文拼接',
      '每条引用都能从映射表找回 chunkId 与 start/end',
      '工具结果里没有手机号、完整地址等无关字段',
    ],
  },
  'p5-t3-agent-integration/p5-t3-s3': {
    approach: [
      '三类各跑一次：政策类（签收多久能退）、订单加政策类（ORD-100234 还能退吗，应同时出现检索与 get_order_status）、无答案类（海外仓退税）。',
      '把输入、工具序列、引用编号、回答、token 记进 docs/phase5-evidence.md。',
      '失败案例指答得不对（如通用政策套具体订单），不只是跑挂。',
    ].join('\n'),
    verify: [
      '至少一次运行里同时出现 search_kb 与 get_order_status',
      '每条政策结论都能对上具体引用编号',
      '无答案场景的回复里没有任何具体政策条款',
    ],
  },
  'p5-t4-task-records-ui/p5-t4-s1': {
    approach: [
      '先画线框再写代码：左会话、中对话、右证据面板（引用加运行时间线）。',
      '状态只四个：answered / needs_human / waiting_approval / failed，颜色加文字双编码。',
      '小于 1024px 右栏收成抽屉；先用假数据把布局跑顺再接接口。',
    ].join('\n'),
    verify: [
      '375 / 768 / 1440 三种宽度下布局都不溢出',
      '四个状态在界面上有明确文案，不是只换颜色',
      '右栏能同时显示引用与工具步骤',
    ],
  },
  'p5-t4-task-records-ui/p5-t4-s2': {
    approach: [
      'GET /api/conversations/:id 返回 messages，每条带 citations（index、docId、title、headingPath、start、end）。',
      '引用做成可点 [1]，点开在右栏显示原文与标题路径；工具步骤用折叠面板显示参数、耗时、结果摘要。',
      '脱敏放服务端，前端脱敏等于没脱敏；长 JSON 用 max-height 滚动。',
    ].join('\n'),
    verify: [
      '点击每条引用都能打开对应原文片段',
      '工具步骤默认收起，展开能看到参数与耗时',
      '接口响应里已经看不到完整手机号',
    ],
  },
  'p5-t4-task-records-ui/p5-t4-s3': {
    approach: [
      '加载用骨架屏，超 8 秒改成「仍在处理」；空状态写下一步动作并给按钮；id 查不到显示「会话不存在或已归档」；网络错误给能真重发的重试按钮。',
      '每个请求设 10 秒超时，全局只剩一个无限 spinner 就是假死。',
    ].join('\n'),
    verify: [
      '断网后刷新页面，出现错误提示与可点的重试',
      '手动把 URL 改成不存在的 id，显示 404 而不是空白',
      '新账号首次进入显示空状态引导',
    ],
  },
  'p5-t5-approval-ui/p5-t5-s1': {
    approach: [
      '在 src/policy/policy.ts 写显式表：search_kb、get_order_status → allow；issue_refund、change_address → approve（金额大于 500 加二次确认）；export_customers、change_role → deny。',
      'canExecute(toolName, args, session) 返回 { decision, reason }，default 分支必须 return deny。',
      '禁止项只看工具名，参数传 limit 1 也 deny。',
    ].join('\n'),
    verify: [
      'policy.ts 的 default 分支是 deny',
      '未注册的工具名调用返回 deny 且写了一条审计',
      '金额 600 的退款返回 approve 且要求二次确认',
    ],
  },
  'p5-t5-approval-ui/p5-t5-s2': {
    approach: [
      '卡片显示订单号、金额、原因、申请人、过期倒计时；点批准先弹确认框原样展示参数快照，再 POST decide。',
      '操作后重新拉列表，409 提示「已被处理，列表已刷新」；拒绝必填原因至少 5 字，写入 Approval.reason 与 history。',
      '过期卡片变灰并去掉按钮。',
    ].join('\n'),
    verify: [
      '卡片上能同时看到订单号、金额、原因、过期时间',
      '批准后该条消失、run 状态推进',
      '重复点批准出现冲突提示，而不是静默成功',
      '拒绝时未填原因无法提交',
    ],
  },
  'p5-t5-approval-ui/p5-t5-s3': {
    approach: [
      '用 curl 直接打实际执行路由（如 POST /api/runs/:runId/tools/issue_refund，按项目填），不带 approvalId 应 403；用 rejected 或改过 argsHash 的审批重放应 409；A 租户会话查 B 租户订单应 403 或统一的「订单不存在」。',
      '三条都要在 audit 集合留痕：谁、何时、哪个工具、原因。',
      'JSON 写文件用 -d @refund.json，避开 Windows 引号问题。',
    ].join('\n'),
    verify: [
      '三条越权请求分别返回 403 / 409 / 403，且都没有执行副作用',
      'audit 集合里能查到对应的拒绝记录',
      '前端正常流程仍然可用，没有把正常请求一起拒掉',
    ],
  },
  'p5-t6-playbook/p5-t6-s1': {
    approach: [
      '三份放 knowledge/playbooks/：returns-refund.md、logistics-exception.md、account-invoice.md，每份六段：适用条件、要收集的信息、只读检查顺序、可给的承诺边界、需审批动作、转人工条件。',
      '承诺边界写具体句子（「7 天内可退」可以，「今天一定到账」不行），写「注意措辞」等于没写。',
    ].join('\n'),
    verify: [
      '三份文件都存在且六段齐全',
      '每份至少列出 1 个需审批动作与 1 个转人工条件',
      '承诺边界是可直接引用的句子，不是形容词',
    ],
  },
  'p5-t6-playbook/p5-t6-s2': {
    approach: [
      '每份顶部写 title 与 slug，用同一套脚本入库，visibility 设 internal，检索结果标 sourceType "playbook"。',
      '回答要求写出「依据《退货退款流程》第 3 节」，即出现标题而不是粘贴全文。',
      'prompt 加：没检索到 Playbook 就不许声称有流程；别拿最相近的一份顶上。',
    ].join('\n'),
    verify: [
      '回答里出现 Playbook 标题与章节',
      '把三份 Playbook 临时移出索引后，回答不再声称有流程',
      'prompt 里没有整段粘贴 Playbook 正文',
    ],
  },
  'p5-t6-playbook/p5-t6-s3': {
    approach: [
      'POST /api/handoffs，body 只传 { conversationId, reason }，摘要服务端生成：用户诉求、已确认事实、已尝试动作、建议下一步。',
      '触发条件写进 policy：用户要人工、连续 2 次工具失败、金额超限、情绪关键词。',
      '转接后 status 置 needs_human，循环看到就不再自动回复 —— 摘要漏了「试过什么」，接手的人会让用户重讲。',
    ].join('\n'),
    verify: [
      '触发转接后 conversation.status 是 needs_human，再发消息无自动回复',
      '摘要里同时有用户诉求、已确认事实、已尝试动作',
      'db.handoffs 里能查到该记录并带时间',
    ],
  },
  'p5-t7-sse-ui/p5-t7-s1': {
    approach: [
      '事件定死六个：retrieval.started、tool.called、message.delta、citation、run.finished、heartbeat。',
      '信封 { conversationId, seq, at, type, payload }，seq 从 1 单调递增，是前端去重排序的唯一依据（时间戳同毫秒分不清）。',
      'heartbeat 每 15 秒，前端只更新活跃时间不渲染；事件落库以便按 seq 补发。',
    ].join('\n'),
    verify: [
      '协议文档里六个事件都有字段表',
      '实际事件流里 seq 连续无重复',
      '15 秒没有新内容时能看到 heartbeat',
    ],
  },
  'p5-t7-sse-ui/p5-t7-s2': {
    approach: [
      'GET /api/conversations/:id/events，用 reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" })，别用 reply.send，它会结束响应。',
      '每条事件是 id、data、空行三件套，缺空行前端不触发；支持 afterSeq 或 Last-Event-ID 补发。',
      'close 时清订阅与心跳定时器，否则每次刷新留一个监听器。',
    ].join('\n'),
    verify: [
      'curl -N 能看到 retrieval.started 等事件，且每条以空行结尾',
      '断开重连后事件从 afterSeq 之后继续，没有缺口',
      '反复断开 10 次，进程的监听器数量没有持续增长',
    ],
  },
  'p5-t7-sse-ui/p5-t7-s3': {
    approach: [
      '用 EventSource("/api/conversations/" + id + "/events?afterSeq=" + lastSeq)；收到事件先判断 seq 是否小于等于 lastSeq，是就丢，这就是去重。',
      'message.delta 追加到当前回答，citation 挂到该消息；onerror 连续 3 次就 close 并切 3 秒轮询，提示「实时连接中断，已切换轮询」。',
      '卸载时 es.close()，否则热更新会攒一堆连接。',
    ].join('\n'),
    verify: [
      '断网 3 次后界面出现「已切换轮询」提示',
      '恢复网络后消息不重复、不丢',
      '刷新页面后历史消息完整，seq 从服务端最新值继续',
    ],
  },
  'p5-t8-acceptance/p5-t8-s1': {
    approach: [
      '五个镜头：问退货政策（回答带 [1]）→ 要求退款（审批卡片含金额与订单号）→ 批准（时间线多 tool.called，状态 succeeded）→ 问知识库没有的问题（明说未说明并转人工）→ 看转接摘要。',
      '写进 docs/demo-script.md，每步标注证据在哪一栏；先掐表跑一遍，控制在 3–5 分钟。',
    ].join('\n'),
    verify: [
      '脚本里每一步都写了预期可见结果',
      '覆盖引用、审批、转人工三类路径',
      '先掐表跑一遍，时长落在 3–5 分钟',
    ],
  },
  'p5-t8-acceptance/p5-t8-s2': {
    approach: [
      '录屏前清数据或开新会话；演示后立刻记 conversationId、runId、引用的 chunkId、审批 id、handoff id 到 docs/phase5-evidence.md。',
      '自查三问：有无无引用结论、有无未审批写操作、失败时用户看到什么。',
      '问题进 docs/bugs.md，一条一行：现象、复现步骤、影响、是否阻塞验收。',
    ].join('\n'),
    verify: [
      '证据文件里五类 id 都有，且现在仍能查到',
      '录屏中出现至少一处引用高亮与一处审批卡片',
      'docs/bugs.md 至少有一条真实问题',
    ],
  },
  'p5-t8-acceptance/p5-t8-s3': {
    approach: [
      'M1–M7 逐条对照事实更新，只能 mock 的写「mock 完成」。',
      '新建验收记录：标题、演示链接、证据文件路径、三个指标（引用覆盖率、审批拦截次数、转人工次数），再写「未完成与原因」。',
      '最后加一句「如果再做一遍会先做什么」；状态与事实不一致比没做更伤。',
    ].join('\n'),
    verify: [
      'M1–M7 每条状态都能对应到一个可打开的链接或命令',
      '验收记录里有三个具体数字',
      '未完成项写明了原因与下一步',
    ],
  },
};
