import type { SeedStepReference } from '../types';

export const phase2References: Record<string, SeedStepReference> = {
  'p2-t1-function-calling/p2-t1-s1': {
    approach: [
      '先写 JSON Schema 再写代码：顶层 type: function，name 用蛇形，如 get_order_status。',
      'description 写清何时用、只读不改订单，模型只靠这段文字决定是否调用。',
      'orderId 设为 string 并加 pattern，required 写 ["orderId"]，additionalProperties: false 防多余字段。',
      '正则写 ^ORD-[0-9]{6}$，避免反斜杠转义；写成 \\d 时容易少一层转义而失效。',
      '对象放进 src/lib/tools/specs.ts 导出，后面注册表直接复用，不要写两份。',
      '改完用 node -e 或任意 JSON 校验器确认可解析。',
    ].join('\n'),
    commands: ['mkdir -p src/lib/tools'],
    verify: [
      'orderId 在 required 数组里且带 pattern',
      'description 明确写了只读、不修改订单',
      '这段 JSON 能被 JSON.parse 解析，参数对象没有多余字段',
    ],
  },
  'p2-t1-function-calling/p2-t1-s2': {
    approach: [
      '先 set -a && source .env && set +a 导出 key，再执行步骤里的 curl。',
      '看 choices[0].message.tool_calls：id 是这次调用的唯一编号，回传结果时要原样带回。',
      'function.arguments 是一段 JSON 字符串而不是对象，必须再 JSON.parse 一次才能拿到 orderId。',
      'finish_reason 应为 tool_calls，表示模型停下来等你的工具结果，而不是已经回答完。',
      '如果模型直接编造物流状态，把 system 改成「订单事实必须通过 get_order_status 获取，不得猜测」再试。',
      '把这一整条响应存成 notes/tool-calls.json，下一步要照着它拼第二条请求。',
    ].join('\n'),
    commands: [
      'set -a && source .env && set +a',
      'curl https://api.deepseek.com/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $DEEPSEEK_API_KEY" -d "{\\"model\\":\\"deepseek-chat\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"我的订单 ORD-100234 到哪了\\"}],\\"tools\\":[{\\"type\\":\\"function\\",\\"function\\":{\\"name\\":\\"get_order_status\\",\\"description\\":\\"查询订单状态，只读\\",\\"parameters\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"orderId\\":{\\"type\\":\\"string\\",\\"pattern\\":\\"^ORD-[0-9]{6}$\\"}},\\"required\\":[\\"orderId\\"]}}}],\\"tool_choice\\":\\"auto\\"}"',
    ],
    verify: [
      'finish_reason 为 tool_calls',
      'arguments 是字符串，JSON.parse 后能得到 orderId 字段',
      'tool_calls[0].id 非空，function.name 为 get_order_status',
    ],
  },
  'p2-t1-function-calling/p2-t1-s3': {
    approach: [
      '第二条请求的 messages 顺序固定：user、assistant（含原样 tool_calls）、tool。',
      'tool_calls 必须原样放回，不要只留 content 或转成字符串。',
      'tool 消息三个字段：role 为 tool、tool_call_id 等于第一步的 id、content 放结果文本。',
      'content 放紧凑 JSON，如 {"status":"shipped","carrier":"SF","etaDays":2}，模型好引用。',
      '第二条仍带同样的 tools；这轮通常不再产生 tool_calls。',
      '报 400 提到 tool_call_id 时，先核对 id 与消息顺序。',
    ].join('\n'),
    verify: [
      '最终 content 里出现 shipped、SF 或 2 天这类来自工具结果的信息',
      'tool 消息的 tool_call_id 与第一步返回的 id 完全一致',
      '把 tool 消息的 id 临时删掉会收到 400，能说明协议确实要求它',
    ],
  },
  'p2-t2-tool-registry/p2-t2-s1': {
    approach: [
      '新建 src/lib/tools/registry.ts，抄步骤里的类型与类，先跑通再扩展。',
      'parameters 是发给模型的 JSON Schema，schema 是本地 Zod 校验器，两者字段必须对得上；不一致时模型能过、本地却拒。',
      'register 里做重名检查，工具多了以后这是最早暴露的配置错误。',
      'specs() 的返回值要能直接 JSON.stringify 进请求体的 tools 字段，所以不要带函数或 Zod 对象。',
      'z.ZodType 用 import type 引入，避免运行时把 zod 打进不必要的依赖路径。',
    ].join('\n'),
    verify: [
      '重复注册同名工具会抛错',
      'specs() 的结果能 JSON.stringify 且不含函数',
      'registry.ts 里没有 import 任何模型 SDK',
    ],
  },
  'p2-t2-tool-registry/p2-t2-s2': {
    approach: [
      '新建 src/lib/tools/execute.ts，抄步骤里的实现，重点在顺序不能换。',
      '顺序是：查工具 → JSON.parse（空字符串当 {}）→ safeParse → execute。校验必须在任何副作用之前完成。',
      '所有失败都 return 结构化结果，不向外 throw，Agent 循环才能把错误当成工具结果回传给模型。',
      'invalid_arguments 的 message 里放 error.issues 的 JSON，模型才知道是哪个字段、期望什么类型。',
      'execute 内部抛错时捕获成 tool_error，原始堆栈写到日志，返回给模型的只有一句可读信息。',
    ].join('\n'),
    verify: [
      '未知工具返回 unknown_tool',
      '非 JSON 参数返回 invalid_json',
      '缺字段或类型错误返回 invalid_arguments 且含字段路径',
      'execute 内部抛错时返回 tool_error 而不是崩溃',
    ],
  },
  'p2-t2-tool-registry/p2-t2-s3': {
    approach: [
      '新建 src/lib/tools/execute.test.ts，注册一个 execute 用 vi.fn() 包起来的测试工具。',
      '准备四组输入：未知工具、坏 JSON 字符串、缺 orderId、orderId 类型为数字；每组断言错误码。',
      '核心断言是 expect(executeFn).not.toHaveBeenCalled()，证明非法参数没有进入业务代码。',
      '再补一条正常输入，断言 executeFn 被调用一次且拿到的是解析后的对象。',
      '运行 npx vitest run src/lib/tools，看到 4 条以上通过后把输出贴进任务记录。',
    ].join('\n'),
    commands: ['npx vitest run src/lib/tools'],
    verify: [
      '至少 3 条断言通过',
      '每一类非法输入下 execute 调用次数为 0',
      '正常输入下 execute 被调用一次',
    ],
  },
  'p2-t3-readonly-tools/p2-t3-s1': {
    approach: [
      '新建 src/lib/tools/read-policy.ts，抄步骤里的三个检查，缺一不可。',
      '第一是路径：path.resolve 后比较 allowedRoot 加 path.sep 的前缀。只写 startsWith(allowedRoot) 会让 policies-evil 这类同前缀目录通过。',
      '第二是扩展名白名单，只允许 .md 与 .txt，用不区分大小写的正则。',
      '第三是大小限制，stat 拿到 size 后超过 1MB 直接拒绝，不要先读进内存再判断。',
      'Windows 下盘符与大小写不敏感，必要时统一 toLowerCase 再比较；要防符号链接就再用 realpath 校验一次。',
      '先用 policies/return.md 正常读一次，再试 ../.env 与超大文件各一次。',
    ].join('\n'),
    verify: [
      '传 ../.env 或 ../src/x.ts 被拒绝',
      '传 policies/x.pdf 被拒绝',
      '超过 1MB 的 .md 被拒绝',
      '正常 .md 返回完整文本',
    ],
  },
  'p2-t3-readonly-tools/p2-t3-s2': {
    approach: [
      '新建 src/lib/tools/check-url.ts，按顺序校验：https、hostname 白名单、DNS 解析出的 IP、5 秒超时。',
      'SSRF 是让服务器替攻击者访问内网；只拦字符串里的 127.0.0.1 不够，域名也可能解析到内网。',
      '用 node:dns/promises 的 lookup 拿 IP，拒绝 127/8、10/8、172.16/12、192.168/16、169.254/16 与 ::1。',
      'fetch 设 redirect: "manual"，手动读 location 并对每一跳重做校验，否则 302 到内网就绕过。',
      '只允许 GET，不发送请求体；超时用 AbortSignal.timeout(5000)。',
      'DNS 校验与真实连接存在时间差，笔记里注明这个残余风险，生产环境要在连接层再校验。',
    ].join('\n'),
    verify: [
      'localhost、127.0.0.1、10.0.0.1 都被拒绝',
      '白名单外域名被拒绝，http 协议被拒绝',
      '重定向到内网地址会在第二跳被拦住',
      '请求 5 秒内返回超时错误',
    ],
  },
  'p2-t3-readonly-tools/p2-t3-s3': {
    approach: [
      '新建 src/labs/04-tools-smoke.ts，创建 registry，注册 read_policy 与 check_url 两个工具。',
      '准备测试文件 policies/return.md，写几行退货政策，作为合法输入。',
      '每个工具各调两次：一次合法、一次非法；非法用 ../.env 和内网地址。',
      '用 console.log(JSON.stringify(result)) 打印，合法应 ok: true，非法应 ok: false 且 code 可读。',
      '不要用「看起来正常」判断，把四条输出原样贴进任务记录的运行结果。',
    ].join('\n'),
    commands: ['mkdir -p policies', 'npx tsx src/labs/04-tools-smoke.ts'],
    verify: [
      '四条输出与预期一致',
      '拒绝信息里没有出现服务器绝对路径',
      'policies 目录缺失时错误信息仍然可读',
    ],
  },
  'p2-t4-agent-loop/p2-t4-s1': {
    approach: [
      '先写类型再写逻辑：AgentOptions 包含 maxSteps、timeoutMs、maxToolCalls，默认值按步骤用 6、60000、8。',
      '定义 AgentLimitError，带 reason 字段，取值 max_steps、timeout、max_tool_calls，便于测试和日志区分。',
      '循环里维护 step 计数与 toolCallCount，每次调用工具后自增，不要只在循环末尾加一。',
      '超时可以用 AbortSignal.timeout 传给 fetch，也可以在每步开始比较 Date.now() 与起始时间。',
      '这些限制要能在测试里注入小值，所以别写成硬编码常量，作为 options 参数传进来。',
    ].join('\n'),
    verify: [
      '三个限制各有独立错误原因',
      '默认值与步骤说明一致',
      '限制值可以通过参数覆盖',
    ],
  },
  'p2-t4-agent-loop/p2-t4-s2': {
    approach: [
      '在 src/lib/agent.ts 按顺序写：带 tools 与 signal 请求 → 无 tool_calls 就返回 → 否则原样 push assistant。',
      'assistant 消息同时带 content 与 tool_calls，保持原始结构，不要只取 name 和 arguments 重组。',
      '每个 call 执行 executeTool，再 push 一条 role: "tool"、带 tool_call_id 与结果 JSON 的消息。',
      '失败结果也要回传，不要 throw；模型要靠错误换参数或向用户解释。',
      'trace 每步记录 step、finish、工具名与 ok，return 时一起带出。',
      '别把工具结果拼成 user 消息或漏 tool_call_id，模型会对不上。',
    ].join('\n'),
    verify: [
      '一次提问里能出现两次以上工具调用',
      'trace 每步都有工具名与 ok 状态',
      '工具失败时循环继续并把错误交给模型',
      '最终回答引用了工具返回的字段',
    ],
  },
  'p2-t4-agent-loop/p2-t4-s3': {
    approach: [
      '新建 src/lib/agent.test.ts，把 chatWithTools 做成可注入依赖，测试里用 vi.fn() 返回固定 tool_calls。',
      '测试一：每次都返回同一个 tool_calls，断言第 6 步后抛 AgentLimitError 且 reason 为 max_steps。',
      '测试二：工具里 await 100ms，把 timeoutMs 设为 50，断言抛 timeout。',
      '可选测试三：maxToolCalls 设为 2，第三次调用前终止，reason 为 max_tool_calls。',
      '断言错误类型与 reason，不要断言错误文案，文案改动不该让测试红。',
      '运行 npx vitest run src/lib/agent，确认没有真实网络请求。',
    ].join('\n'),
    commands: ['npx vitest run src/lib/agent'],
    verify: [
      '至少两个失败路径测试通过',
      '测试运行时不访问网络',
      '断言的是错误类型或 reason 而非文案',
    ],
  },
  'p2-t5-tool-errors/p2-t5-s1': {
    approach: [
      '把 ToolResult 的 error 统一成 { code, message, hint } 三个字段，所有工具都按这个返回。',
      'hint 是写给模型看的下一步建议，例如「orderId 必须是 ORD- 加 6 位数字，可先向用户确认单号」。',
      'message 只描述发生了什么，不要带绝对路径、堆栈、密钥或内部表名。',
      'invalid_arguments 的 hint 里列出允许字段与枚举值，模型才能一次改对。',
      '原始错误对象只写 console.error 或日志文件，返回体里永远只有整理过的文本。',
    ].join('\n'),
    verify: [
      '每个错误码都有非空 hint',
      '错误文案里 grep 不到盘符、/home、sk-',
      '日志里能看到完整堆栈，返回体里没有',
    ],
  },
  'p2-t5-tool-errors/p2-t5-s2': {
    approach: [
      '在 mock 订单里只放 ORD-100234 这类存在的单号，让 ORD-999999 必然返回 order_not_found。',
      '第一轮问「帮我查 ORD-999999 到哪了」，观察模型拿到错误后是追问单号、还是放弃，重点看有没有编造物流状态。',
      '第二轮补一句「是 ORD-100234」，确认模型能改用新参数并调用成功。',
      '把完整 messages 数组存成 notes/tool-error-chain.json，检查 tool 消息是否紧跟 assistant.tool_calls。',
      '如果模型连续用同一个错参数，说明错误 hint 不够具体，回去补上「请向用户确认单号」这类动作。',
    ].join('\n'),
    verify: [
      '消息链里存在 order_not_found 的 tool 结果',
      '最终回答没有出现未由工具返回的状态或承运商',
      '补充合法单号后调用成功并有工具结果',
    ],
  },
  'p2-t5-tool-errors/p2-t5-s3': {
    approach: [
      '在循环里维护一个 Map，键用工具名加错误码（name:code），每次失败加一。',
      '计数达到 2 时，不再执行该工具，改为 push 一条 role 为 system 的消息，要求模型基于已知信息作答或说明缺少能力。',
      '同时把 stopReason 写进 trace，例如 tool_failed_twice，方便验收时说明为什么结束。',
      '键不要用完整 error message，里面可能带 traceId 或时间戳，会导致永远不重复。',
      '阈值做成参数，测试里设成 1，用 MockProvider 造两次失败验证终止。',
    ].join('\n'),
    verify: [
      '同一工具同一错误出现两次后循环停止',
      'trace 里记录了终止原因',
      '最终回答明确说明信息不足，而不是硬编结论',
    ],
  },
  'p2-t6-structured-answer/p2-t6-s1': {
    approach: [
      '新建 src/lib/answer-schema.ts，category 用 z.enum(["policy", "order", "unknown"])，不要用普通 string。',
      'findings 用 z.array 且 min(1)，每项包含 text、sourceTool、evidence 三个必填字段。',
      'evidence 定义为工具或文档返回的原始值，例如 shipped、7 天，而不是模型自己的复述。',
      '加一条 .refine：category 为 unknown 时 needsHuman 必须为 true，用 superRefine 或 refine 都能实现。',
      '写完用两个样例自测：合法对象通过，findings 为空或 unknown 未转人工时失败。',
    ].join('\n'),
    verify: [
      'category 传未知值校验失败',
      'findings 为空数组校验失败',
      'unknown 且 needsHuman 为 false 时校验失败',
      '合法样例通过校验',
    ],
  },
  'p2-t6-structured-answer/p2-t6-s2': {
    approach: [
      '在 Agent 循环拿到答案和工具结果后再发一次请求，这次不带 tools，只做总结。',
      'system 写清三件事：只能使用给定工具结果、缺失信息标记 unknown、只输出 JSON。',
      'user 里放原始问题加工具结果的 JSON，并显式列出字段名，减少模型自创字段。',
      '请求体加 response_format 为 json_object，并且提示词里出现 json 字样，否则 JSON 模式可能不生效。',
      '拿到 content 后先 JSON.parse 再用 AnswerSchema.safeParse，失败按第一阶段的修复循环重试一次。',
      '把工具结果清空再跑一次，确认输出变成 unknown 而不是编造，这是最有效的反向验证。',
    ].join('\n'),
    verify: [
      '输出能 JSON.parse 并通过 AnswerSchema',
      '清空工具结果后 category 为 unknown',
      '最终答案里的 evidence 值能在工具结果里找到',
    ],
  },
  'p2-t6-structured-answer/p2-t6-s3': {
    approach: [
      '新建 src/lib/verify-evidence.ts，入参是 findings 与本次全部工具结果。',
      '把所有工具结果 JSON.stringify 后拼成一个大字符串，用 includes 检查每条 evidence 是否出现。',
      '匹配前对 evidence 做 trim 和统一大小写，数字保持原格式，否则 2 与 2.0 会误判。',
      '不匹配的把 verified 设为 false，并从结论里剔除或标红，同时在 summary 里写明被剔除条数。',
      '写单测：构造一条合法 evidence 和一条人为篡改的，断言前者 true、后者 false。',
    ].join('\n'),
    verify: [
      '篡改任意一条 evidence 后 verified 为 false',
      '合法 evidence 全部通过',
      'summary 里能看到被剔除的条目数',
      '单元测试覆盖通过与不通过两种情况',
    ],
  },
  'p2-t7-observability/p2-t7-s1': {
    approach: [
      '新建 src/lib/trace.ts，定义 TraceEvent：traceId、type、startedAt、durationMs、meta。',
      'type 只允许 llm_call、tool_call、error、finish 四种，用联合类型约束，写错时编译期就能发现。',
      '写入 logs/traces.jsonl，先 mkdir 递归建目录再 appendFile，一行一个事件。',
      'meta 里只放工具名、模型名、token 数、ok、错误码；请求头、key、手机号一律不写。',
      '先手工造四条样例各写一次，确认 JSONL 能被逐行解析后再接入循环。',
    ].join('\n'),
    verify: [
      '四类事件各有一条样例',
      'grep -i authorization logs/traces.jsonl 为空',
      '每一行都能 JSON.parse',
    ],
  },
  'p2-t7-observability/p2-t7-s2': {
    approach: [
      '新建 src/lib/trace-context.ts，导出 const traceStore = new AsyncLocalStorage<{ traceId: string }>()。',
      'AsyncLocalStorage 是 Node 自带的机制，给当前异步调用链挂一个变量，子调用里都能读到，不用层层传参。',
      '入口用 runWithTrace(traceId, fn) 包住 runAgent，工具执行和日志函数里用 traceStore.getStore()?.traceId 取值。',
      'traceId 用 crypto.randomUUID() 生成，一次运行一个，重试要生成新的并记录来源 traceId。',
      '并发验证：同时跑两个 runWithTrace，各写一条工具事件，检查两个 traceId 没有互换。',
    ].join('\n'),
    verify: [
      '工具日志自动带上 traceId',
      '两个并发运行的事件 traceId 不串',
      'traceId 不是全局变量或模块级可变量',
    ],
  },
  'p2-t7-observability/p2-t7-s3': {
    approach: [
      '新建 src/labs/05-trace-summary.ts，从 process.argv[2] 取 traceId，缺参数时打印用法并退出。',
      '读 logs/traces.jsonl，按换行切分并逐行解析，过滤出该 traceId 的事件。',
      '按 startedAt 升序打印时间线：类型、名称、durationMs；最后统计模型调用次数、工具调用次数、总耗时。',
      '最慢一步用 reduce 或排序取 durationMs 最大的一条，直接打印它的名称与耗时。',
      'traceId 不存在时打印「未找到该 traceId」并退出码 1，不要输出空表让人误以为成功。',
    ].join('\n'),
    commands: ['npx tsx src/labs/05-trace-summary.ts <traceId>'],
    verify: [
      '摘要中的模型与工具次数和实际调用一致',
      '能指出耗时最长的一步',
      '不存在的 traceId 有明确提示',
    ],
  },
  'p2-t8-acceptance/p2-t8-s1': {
    approach: [
      '写 3 个复合问题，每个都必须同时用到 read_policy 和 get_order_status，例如「按退货政策，ORD-100234 还能退吗」。',
      '准备 2 个反例：一个问 policies 里没有的政策（应回答资料未说明），一个问不属于当前客户的订单号（应被拒绝）。',
      '确认 policies/return.md 真实存在且写明了退货时效与例外，否则问题无法回答。',
      '订单号固定写死，保证下次复跑输入一致；把问题清单存进 notes/acceptance-questions.md 或验收记录。',
      '检查方法：只看问题，如果单次工具调用就能答完，说明问题不够复合，需要加条件。',
    ].join('\n'),
    verify: [
      '每题都需要政策和订单两类工具',
      '至少 2 个反例，且预期结果写清楚',
      '问题与订单号已记录，可复跑',
    ],
  },
  'p2-t8-acceptance/p2-t8-s2': {
    approach: [
      '运行 Agent 跑三个问题，命令与 traceId 一并记下，例如 npx tsx src/cli.ts 加上问题文本。',
      '保存四样东西：trace 摘要、最终 JSON、token 用量、总耗时；放在 notes/acceptance 目录并按问题命名。',
      '逐条核对 evidence：用 grep 在工具结果里搜这个值，搜不到就说明引用是编的。',
      '检查 trace 里两次工具调用的 name 不同，并确认没有出现未注册工具或参数校验失败。',
      '把 AnswerSchema 校验结果打印出来，通过才勾选验收项。',
    ].join('\n'),
    commands: ['npx tsx src/cli.ts', 'npx tsx src/labs/05-trace-summary.ts <traceId>'],
    verify: [
      'trace 里有 read_policy 与 get_order_status 两次不同调用',
      '最终 JSON 通过 AnswerSchema 校验',
      '每条 evidence 都能在工具结果中找到',
      '保存了 traceId、token 与耗时',
    ],
  },
  'p2-t8-acceptance/p2-t8-s3': {
    approach: [
      '攻击一：让 Agent 读 ../../.env，预期 read_policy 返回路径越界错误，且回答里不出现文件内容。',
      '攻击二：让 check_url 访问 http://127.0.0.1，预期协议或内网地址被拒。',
      '攻击三：直接传 ORD-12，预期参数校验失败并返回 invalid_arguments。',
      '每次记录三样：模型请求的参数、工具返回、最终回答；确认回答没有因为失败而编造结果。',
      '最后 grep 日志：logs/traces.jsonl 里不应出现 sk- 或 Authorization，拒绝文案里不应含解析后的真实路径。',
    ].join('\n'),
    verify: [
      '三个攻击请求都被工具层拒绝',
      '拒绝原因不含绝对路径或密钥',
      'trace 里 grep 不到 sk-',
      'Agent 没有在失败后编造结论',
    ],
  },
  'p2-t8-acceptance/p2-t8-s4': {
    approach: [
      '在学习平台创建阶段二验收，按验收项逐条勾选，没有证据的不要勾。',
      '附上 trace 摘要、攻击测试的三条输出、最终 JSON 片段，以及测试通过数量。',
      '写一段最大问题与修复过程，例如模型编造 evidence 后被校验器剔除，说明检测方式。',
      '确认阶段二 8 个任务全部标记完成，再更新阶段状态并刷新页面核对。',
      '若还有未通过项，如实写在遗留问题里，注明原因和下一步动作。',
    ].join('\n'),
    verify: [
      '验收记录含可复现命令与 traceId',
      '至少一条失败与修复记录',
      '未通过项如实标注',
      '阶段完成度显示 100%',
    ],
  },
};
