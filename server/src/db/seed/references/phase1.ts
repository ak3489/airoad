import type { SeedStepReference } from '../types';

export const phase1References: Record<string, SeedStepReference> = {
  'p1-t1-setup-lab/p1-t1-s1': {
    approach: [
      '先 pwd 确认不在 airoad 仓库里，练习代码单独放一个 agent-lab 目录。',
      '依次执行下方命令：建目录并进入、git init、npm init -y、安装 typescript tsx @types/node dotenv。',
      'tsx 直接运行 .ts 文件（省掉编译），dotenv 把 .env 读进 process.env；装完应看到 package.json、node_modules、package-lock.json。',
      '在 package.json 加 "type": "module"，scripts.dev 改成 "tsx src/hello.ts"，手改 JSON 注意逗号。',
      '装包报代理或证书错误，先查 npm config get registry 与 HTTPS_PROXY，不要关闭证书校验。',
    ].join('\n'),
    commands: [
      'mkdir agent-lab && cd agent-lab',
      'git init',
      'npm init -y',
      'npm i -D typescript tsx @types/node dotenv',
      'npm ls tsx dotenv',
    ],
    verify: [
      'git rev-parse --show-toplevel 指向 agent-lab，而不是 airoad',
      'npm ls tsx dotenv 能输出两个包的版本',
      'package.json 里同时有 type 和 scripts.dev',
    ],
  },
  'p1-t1-setup-lab/p1-t1-s2': {
    approach: [
      '在 agent-lab 根目录新建 tsconfig.json，直接抄步骤里的配置，strict 必须是 true。',
      'module 和 moduleResolution 都设为 NodeNext，意味着相对导入要写 .js 后缀（源码是 .ts，import 写 ./x.js），这是最常见的报错来源。',
      '执行 mkdir -p src/lib src/labs 建目录，再放一个空的 src/hello.ts 占位。',
      '运行 npx tsc --noEmit 做只检查不产出的类型校验，没有输出就是通过。',
      '如果提示找不到 node 类型，检查 types 数组里是否有 "node"，以及 @types/node 是否装成功。',
    ].join('\n'),
    commands: ['mkdir -p src/lib src/labs', 'npx tsc --noEmit'],
    verify: [
      'tsconfig.json 里 strict 为 true',
      'src/lib 与 src/labs 两个目录都存在',
      'npx tsc --noEmit 无报错输出',
    ],
  },
  'p1-t1-setup-lab/p1-t1-s3': {
    approach: [
      '在 agent-lab 根目录新建 .env，写入四个变量：DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL、DEEPSEEK_MODEL。key 只在本机输入，不要贴进聊天或截图。',
      '新建 .gitignore，内容至少四行：node_modules、.env、dist、*.log。',
      '新建 src/hello.ts，抄步骤里的代码；关键行是第一行 import "dotenv/config"，它必须最先执行，否则读不到变量。',
      '脚本只打印 key 是否配置和长度，绝不打印 key 本身。',
      '运行 npm run dev，看到 node 版本、key configured: true、key 长度和模型名。',
      '若 key configured 为 false，先确认执行命令时的工作目录有 .env，再确认文件名没有变成 .env.txt。',
    ].join('\n'),
    commands: ['npm run dev', 'git check-ignore -v .env'],
    verify: [
      '终端输出 key configured: true，且没有任何完整 key 字符串',
      'git check-ignore -v .env 有输出，说明被忽略',
      '把 .env 临时改名后重跑，能看到「缺少 DEEPSEEK_API_KEY」并退出码非 0',
    ],
  },
  'p1-t1-setup-lab/p1-t1-s4': {
    approach: [
      '先跑 git status，逐行看「要提交的变更」里有没有 .env；看到就立刻停下。',
      '如果 .env 已被加入暂存区，执行 git rm --cached .env 并确认 .gitignore 生效，再重新提交。',
      '确认干净后执行 git add .、git commit -m "chore: bootstrap agent-lab"，再跑 git status 应显示 nothing to commit。',
      '回到学习平台的任务笔记，记录 node -v 的输出、操作系统与版本、DEEPSEEK_MODEL 的值（不记 key）。',
      '提交后可用 git ls-files 核对文件清单，里面不应出现 .env。',
    ].join('\n'),
    commands: ['git status', 'git add .', 'git commit -m "chore: bootstrap agent-lab"', 'git status'],
    verify: [
      'git status 显示工作区干净',
      'git log --oneline 能看到这条提交',
      'git ls-files 的文件列表里没有 .env',
      '任务笔记里写了 Node 版本与模型名',
    ],
  },
  'p1-t2-first-chat-call/p1-t2-s1': {
    approach: [
      '先 set -a && source .env && set +a 导出变量，curl 里的 $DEEPSEEK_API_KEY 才有值。',
      '请求发到 /chat/completions，两个 header：Content-Type 与 Authorization: Bearer 加 key。',
      'messages 是数组，每条含 role 和 content；Chat Completions 无状态，每次都要带完整历史。',
      '用 choices[0].message.content 取回复，usage 的 prompt_tokens 是输入、completion_tokens 是输出；token 是计费单位，约一个词或半个汉字。',
      '401 先查 Bearer 前缀与变量导出，429 说明限流，降低频率再试。',
    ].join('\n'),
    commands: [
      'set -a && source .env && set +a',
      'curl https://api.deepseek.com/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $DEEPSEEK_API_KEY" -d "{\\"model\\":\\"deepseek-chat\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"用一句话解释什么是 Agent\\"}]}"',
    ],
    verify: [
      '响应 JSON 中 choices[0].message.content 有一段真实中文回复',
      'usage 里能同时看到 prompt_tokens 与 completion_tokens',
      '终端历史或笔记里没有完整 key',
    ],
  },
  'p1-t2-first-chat-call/p1-t2-s2': {
    approach: [
      '新建 src/lib/deepseek.ts，步骤里已给出完整代码，直接照抄，不要一边抄一边改结构。',
      '关键点一：AbortSignal.timeout(30000) 让请求最多等 30 秒，超时会抛 TimeoutError。',
      '关键点二：先判断 res.ok，再 res.json()；非 2xx 时读取 res.text() 并截断 300 字符，避免错误信息刷屏。',
      '关键点三：baseUrl 拼接时不要重复或缺少斜杠，代码里是 baseUrl 加 /chat/completions。',
      '关键点四：choices 数组可能为空，生产代码要判空后再取 message.content。',
      '文件里不要写死 key，key 一律从 process.env 读取。',
    ].join('\n'),
    verify: [
      'callChat 的返回类型是 Promise<ChatResult>',
      '把 baseUrl 改成不存在的域名，能收到带原因的报错而不是静默 undefined',
      'npx tsc --noEmit 通过',
    ],
  },
  'p1-t2-first-chat-call/p1-t2-s3': {
    approach: [
      '新建 src/labs/01-first-call.ts，导入 callChat，用顶层 await 调用并打印 content 与 usage。',
      '把 package.json 的 dev 改成 "tsx src/labs/01-first-call.ts"，或者直接用 npx tsx 指定文件。',
      '运行后应看到一段回复，以及 prompt、completion、total 三个 token 数字。',
      '把一次真实响应去掉 header 后存到 notes/first-call.json，作为后续对比样例。',
      '如果报 ECONNREFUSED，先确认能访问 api.deepseek.com；用代理时要在代码里指定 dispatcher，环境变量对 fetch 不自动生效。',
    ].join('\n'),
    commands: ['npx tsx src/labs/01-first-call.ts'],
    files: [
      {
        filePath: 'src/labs/01-first-call.ts',
        language: 'typescript',
        content: [
          'import "dotenv/config";',
          'import { callChat } from "../lib/deepseek.js";',
          '',
          'const result = await callChat("用两句话说明什么是 function calling");',
          'console.log("回复:", result.content);',
          'console.log("usage:", result.usage);',
        ].join('\n'),
      },
    ],
    verify: [
      '打印出非空的模型回复',
      'usage 中 total_tokens 等于 prompt 与 completion 之和',
      'notes 目录里保存了一份去掉密钥的响应样例',
    ],
  },
  'p1-t2-first-chat-call/p1-t2-s4': {
    approach: [
      '先备份 .env，再把 DEEPSEEK_API_KEY 改成一个明显错误的值。',
      '重跑脚本，期望看到类似 DeepSeek 401 的错误，并且后面带着截断的响应体。',
      '恢复 key，再把 30_000 临时改成 1 跑一次，验证超时分支会抛 TimeoutError；改回 30_000 并确认文件里是原值。',
      '如果 401 时看到的是 undefined 或空字符串，回到 callChat 检查是否在 res.json() 之前就抛错。',
      '把两次真实错误消息各截一条到任务笔记，注明是人为制造。',
    ].join('\n'),
    commands: ['DEEPSEEK_API_KEY=bad-key npx tsx src/labs/01-first-call.ts'],
    verify: [
      '错误消息里包含状态码 401',
      '错误文本长度不超过 300 字符左右',
      '恢复配置后能再次成功调用',
      '源码里的超时值已改回 30000',
    ],
  },
  'p1-t3-multi-turn/p1-t3-s1': {
    approach: [
      '新建 src/prompts.ts，导出一个字符串常量 SYSTEM_PROMPT，控制在 120 字以内。',
      '内容包含四件事：角色（AI Agent 学习教练）、回答格式（先结论再步骤）、禁止编造 API 或版本号、不确定时直说。',
      '不要在这里写具体模型名或价格，这些会过时。',
      '接入时把它放在 messages 的第一条，role 为 system。',
      '对比实验：同一问题分别带 system 和不带 system 各问一次，观察回答结构差异。',
    ].join('\n'),
    files: [
      {
        filePath: 'src/prompts.ts',
        language: 'typescript',
        content: [
          'export const SYSTEM_PROMPT = [',
          '  "你是 AI Agent 学习教练。",',
          '  "回答先给一句结论，再给可执行的步骤，每步一行。",',
          '  "不编造 API、参数或版本号；不确定时说明缺少什么信息。",',
          '  "回答控制在 200 字以内，除非用户要求展开。",',
          '].join("");',
        ].join('\n'),
      },
    ],
    verify: [
      'SYSTEM_PROMPT 长度不超过 120 个字符',
      '发出的 messages 第一条 role 是 system',
      '带 system 与不带 system 的回答结构明显不同',
    ],
  },
  'p1-t3-multi-turn/p1-t3-s2': {
    approach: [
      '先在 deepseek.ts 加 callChatMessages(messages)：请求体不变，messages 改成参数，原 callChat 可改为调用它。',
      '新建 src/lib/conversation.ts，构造函数接收带 chat(messages) 的对象和 systemPrompt，先 push system。',
      'chat(userText) 里 push user、调用 this.llm.chat(this.messages)、把 content push 成 assistant 后返回。',
      '顺序必须是 system、user、assistant 循环，不要每轮重复插 system；每轮打印 size，正常是 1、3、5。',
      '导入路径写 .js 后缀（NodeNext 要求）；getMessages 返回只读数组。',
    ].join('\n'),
    verify: [
      '两轮对话后 size 等于 5',
      '第二次请求的 messages 里能看到第一次的 assistant 回复',
      'grep 不到重复 push system 的代码',
    ],
  },
  'p1-t3-multi-turn/p1-t3-s3': {
    approach: [
      '新建 src/cli.ts，用 node:readline/promises 的 createInterface 读取输入。',
      '循环里 await rl.question("你> ")；空字符串 continue；输入 /exit 时 break。',
      '拿到输入后 await conv.chat(line)，把返回的字符串打印成「助手> ...」。',
      '结束时在 finally 里 rl.close()，避免进程挂起。',
      '把 package.json 的 dev 指向 src/cli.ts，然后跑 npm run dev。',
      '第一次运行若提示找不到模块，检查 import 路径是否漏了 .js 后缀。',
    ].join('\n'),
    commands: ['npx tsx src/cli.ts'],
    files: [
      {
        filePath: 'src/cli.ts',
        language: 'typescript',
        content: [
          'import "dotenv/config";',
          'import { createInterface } from "node:readline/promises";',
          'import { stdin as input, stdout as output } from "node:process";',
          'import { Conversation } from "./lib/conversation.js";',
          'import { callChatMessages } from "./lib/deepseek.js";',
          'import { SYSTEM_PROMPT } from "./prompts.js";',
          '',
          'const rl = createInterface({ input, output });',
          'const conv = new Conversation({ chat: callChatMessages }, SYSTEM_PROMPT);',
          '',
          'async function main() {',
          '  while (true) {',
          '    const line = (await rl.question("你> ")).trim();',
          '    if (!line) continue;',
          '    if (line === "/exit") break;',
          '    const reply = await conv.chat(line);',
          '    console.log("助手> " + reply);',
          '  }',
          '}',
          '',
          'main()',
          '  .catch((error) => {',
          '    console.error("运行失败", error instanceof Error ? error.message : error);',
          '    process.exitCode = 1;',
          '  })',
          '  .finally(() => rl.close());',
        ].join('\n'),
      },
    ],
    verify: [
      '连续三轮追问能保持上下文（例如第一轮给名字，第三轮问名字）',
      '输入空行不会触发请求',
      '/exit 后进程正常退出，没有等待中的请求',
    ],
  },
  'p1-t3-multi-turn/p1-t3-s4': {
    approach: [
      '在 conversation.ts 顶部加常量 MAX_MESSAGES = 12。',
      '每次 push 完 assistant 后检查长度：超过就从索引 1 开始删两条，保证 user 与 assistant 成对移除，system 永远保留在索引 0。',
      '删除时用 splice(1, 2)；如果只剩一条非 system 消息，就只删一条，不要留下孤立消息。',
      '阶段二会出现 role 为 tool 的消息，那时候要按完整「轮次」删，不能简单数条数。',
      '每次裁剪打印一行「已裁剪」，并在长对话后确认 size 不再增长。',
    ].join('\n'),
    verify: [
      '连续聊 10 轮后 size 不超过 12',
      'messages[0] 始终是 system',
      '终端至少出现过一次「已裁剪」',
      '裁剪后追问最近一轮内容仍能答对',
    ],
  },
  'p1-t4-streaming/p1-t4-s1': {
    approach: [
      '先导出变量：set -a && source .env && set +a，再执行 curl。',
      '关键是 -N：关闭 curl 缓冲，否则内容会攒到最后一次性出现；请求体里必须有 stream: true。',
      '观察每个 data: 行里的 choices[0].delta.content，它是这次新增的文本片段，可能为空字符串。',
      'finish_reason 为 stop 表示生成结束，随后收到一行 data: [DONE]。',
      'SSE 就是服务器用一条长连接不断推「data: 内容」文本行的协议，浏览器和 Node 都能读。',
      '把其中两行原始输出存进笔记，后面排查解析问题时对照。',
    ].join('\n'),
    commands: [
      'curl -N https://api.deepseek.com/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $DEEPSEEK_API_KEY" -d "{\\"model\\":\\"deepseek-chat\\",\\"stream\\":true,\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"数到五\\"}]}"',
    ],
    verify: [
      '能看到多行 data: 开头的 JSON',
      '能指出 delta 与 finish_reason 在 JSON 中的位置',
      '最后一行是 data: [DONE]',
    ],
  },
  'p1-t4-streaming/p1-t4-s2': {
    approach: [
      '新建 src/lib/deepseek-stream.ts，抄步骤里的 async generator 实现。',
      '关键三行：buffer += decoder.decode(value, { stream: true })、用 split("\\n") 后 pop 保留最后半行、payload 等于 [DONE] 时 return。',
      '网络 chunk 边界和 SSE 事件边界无关，所以不能假设一个 chunk 就是一行，也不能对整段 buffer 做 JSON.parse。',
      'line.slice(5) 是去掉 data: 前缀；用 trim 兼容 Windows 的 \\r\\n。',
      '中文乱码说明 decoder 少了 stream: true，未完成的多字节字符被提前解码了。',
      '遇到解析异常应记录并跳过该行，不要让整个流中断。',
    ].join('\n'),
    verify: [
      '中文回复拼接后没有乱码',
      '运行过程中没有 JSON.parse 异常',
      '收到 [DONE] 后 generator 正常结束',
    ],
  },
  'p1-t4-streaming/p1-t4-s3': {
    approach: [
      '在 src/cli.ts 里改用 streamChat：for await 循环里 process.stdout.write(piece)，结束后写一个换行。',
      '记录首字延迟：发请求前记 Date.now()，收到第一段时算差值并打印，后续片段不重复计算。',
      '再调用一次非流式 callChat 问同样的问题，比较两段文本是否语义一致（空白差异可忽略）。',
      '注意不要把流式回复同时再 push 一次到 Conversation，只保留一份 assistant 消息，内容用拼接结果。',
      '首字超过 2 秒先检查是否忘了 stream: true，或误用了非流式接口。',
    ].join('\n'),
    commands: ['npx tsx src/cli.ts'],
    verify: [
      '提问后 2 秒内出现第一段文字',
      '流式拼接文本与非流式回复语义一致',
      '笔记里记录了首字延迟的具体毫秒数',
    ],
  },
  'p1-t4-streaming/p1-t4-s4': {
    approach: [
      '在 cli.ts 里创建 const controller = new AbortController()，把 controller.signal 传给 streamChat。',
      '注册 process.on("SIGINT", () => controller.abort())，Ctrl+C 时中断连接而不是直接杀进程。',
      '中断后 fetch 或 reader.read() 会抛 AbortError，在 catch 里判断 error.name === "AbortError" 后安静退出。',
      '不要让 AbortError 打印完整堆栈，也不要继续往终端写片段。',
      '验证方式：发一个长回答，看到一半按 Ctrl+C，终端应立即回到提示符，进程不残留。',
    ].join('\n'),
    verify: [
      'Ctrl+C 后不再输出新片段',
      '进程 2 秒内退出',
      '终端没有出现 AbortError 的红色堆栈',
    ],
  },
  'p1-t5-json-output/p1-t5-s1': {
    approach: [
      '在 agent-lab 执行 npm i zod；Zod 是运行时校验库，先用它描述数据形状，再用 safeParse 检查真实数据。',
      '新建 src/lib/task-plan.ts，照抄步骤里的 TaskPlanSchema，注意 durationMinutes 的 int() 会拒绝 30.5。',
      'min(3).max(7) 限制步骤数量，acceptance 至少一条且每条至少 4 个字符。',
      '默认情况下多余字段会被丢弃而不是报错，想拒绝多余字段要加 .strict()。',
      '写两个自测：合法对象返回 success，把 steps 改成 2 个应返回 failure 并带 issues。',
    ].join('\n'),
    commands: ['npm i zod', 'npx tsc --noEmit'],
    verify: [
      '3 个步骤的合法对象通过校验',
      '2 个步骤或时长 10 分钟时校验失败',
      'z.infer 导出的 TaskPlan 类型能正常 import',
    ],
  },
  'p1-t5-json-output/p1-t5-s2': {
    approach: [
      '在 src/labs/02-json.ts 里组装请求体，加入 response_format: { type: "json_object" }。',
      'DeepSeek 的 JSON 模式要求提示词里出现 json 字样，所以 system 必须写「只输出 JSON」，否则可能报参数错误。',
      'user 里直接写出字段名与取值范围，例如 title、steps[].title、durationMinutes、acceptance，减少模型自由发挥。',
      '给足 max_tokens（先给 800）；打印 finish_reason，如果是 length 说明被截断，content 会是不完整 JSON。',
      '拿到 content 后先 JSON.parse，再用 TaskPlanSchema.safeParse 校验，两步都要 try/catch。',
    ].join('\n'),
    commands: ['npx tsx src/labs/02-json.ts'],
    verify: [
      'content 可以直接 JSON.parse 成功',
      'finish_reason 为 stop 而不是 length',
      '解析结果通过 TaskPlanSchema 校验',
    ],
  },
  'p1-t5-json-output/p1-t5-s3': {
    approach: [
      '在 task-plan.ts 里加 parseWithRepair(raw, repairFn, maxRepair = 1)。',
      '第一步 try JSON.parse，失败直接进入修复；第二步 TaskPlanSchema.safeParse，失败时取出 error.issues 的 path 与 message。',
      '修复消息里必须包含原始输出、issues 摘要、以及一句「只返回修正后的 JSON，不要解释」，否则模型会加 markdown 代码块。',
      'repairFn 负责发一次新请求并返回 content，修复后再走一遍 parse 加校验，不要递归调用自己。',
      '两次都失败就 throw new Error，错误信息里带 issues 摘要，不要吞掉原始输出。',
    ].join('\n'),
    verify: [
      '正常输出只发一次请求',
      '把 acceptance 的 min 调大后能触发恰好一次修复',
      '两次失败时抛出的错误里能看到 issues',
      'maxRepair 默认为 1，没有无限重试',
    ],
  },
  'p1-t5-json-output/p1-t5-s4': {
    approach: [
      '定义一个模块级计数器对象 stats，字段为 requests、parseFailures、repairSuccess。',
      '在 parseWithRepair 里自增：每次请求加 requests，JSON.parse 或 safeParse 失败加 parseFailures，第二次成功加 repairSuccess。',
      '每轮结束用 console.table(stats) 打印，跑 5 次（可以换不同问法），把数字抄进任务记录。',
      '5 次全成功也如实记录 0 失败，并说明这是样本太小的结果，不要伪造失败。',
      '若出现过失败，把那条原始输出和 issues 存进 notes，写清失败原因（截断、字段名错、中文字符串过长等）。',
    ].join('\n'),
    verify: [
      '5 次运行都有统计输出',
      'requests 等于实际请求次数，且不超过运行次数乘 2',
      '任务记录里能说出至少一个失败样例的原因',
    ],
  },
  'p1-t6-token-cost/p1-t6-s1': {
    approach: [
      '新建 src/lib/usage-log.ts，抄步骤里的 appendCallLog：先 mkdir 递归建 logs，再 appendFile。',
      'JSONL 是一行一个 JSON 的日志格式，方便直接用命令行按行处理，不要写成一个大 JSON 数组。',
      '在 callChat 成功返回后追加一条：at 用 new Date().toISOString()，latencyMs 用 performance.now() 差值取整。',
      'purpose 字段填用途，例如 chat、plan、repair，后面按用途汇总成本才有意义。',
      '把 logs 目录加进 .gitignore，日志里不要写 key、手机号或完整用户问题。',
    ].join('\n'),
    verify: [
      'logs/calls.jsonl 每一行都能 JSON.parse',
      'git check-ignore -v logs 有输出',
      '日志条目里没有 key 和用户原文',
    ],
  },
  'p1-t6-token-cost/p1-t6-s2': {
    approach: [
      '打开资源列表里的 DeepSeek 价格页，记下当前输入与输出单价以及币种，写进 .env 的两个变量。',
      '单位换算注意：价格通常按每百万 token 标价，所以 COST_INPUT_PER_MTOK 填的是每百万 token 的价格。',
      '新建 src/lib/cost.ts，抄步骤里的 costOf，用 Number() 读环境变量，缺省为 0。',
      '不要凭记忆写价格，也不要混用人民币与美元；笔记里写清读取日期、来源网址、币种。',
      '如果价格是分档的（例如缓存命中价），先用标准价算，并在笔记里注明未覆盖分档。',
    ].join('\n'),
    verify: [
      'costOf(1000000, 0) 的结果等于输入单价',
      '笔记里有价格来源网址与读取日期',
      '成本计算与日志里记录的币种一致',
    ],
  },
  'p1-t6-token-cost/p1-t6-s3': {
    approach: [
      '新建 src/labs/03-usage-report.ts：readFile 读 logs/calls.jsonl，按换行 split，忽略空行后逐行 JSON.parse。',
      '用 Map 以 at.slice(0, 10) 为键汇总每天的请求数、prompt 与 completion token、成本。',
      '成本用 costOf 计算，最后 console.table 输出日期、请求数、总 token、成本。',
      '预算守卫放在 callChat 发请求之前：先算当日已花，超过 DAILY_BUDGET 就抛明确错误，例如 daily budget exceeded。',
      '验证守卫：把 DAILY_BUDGET 临时设为 0.000001 跑一次，应被拒绝；再改回合理值确认恢复。',
    ].join('\n'),
    commands: ['npx tsx src/labs/03-usage-report.ts'],
    verify: [
      '报告的请求数与账本行数一致',
      '总 token 相加与账本逐条相加一致',
      '预算很小时调用被拒绝且错误可读',
    ],
  },
  'p1-t7-provider/p1-t7-s1': {
    approach: [
      '新建 src/lib/provider.ts，抄步骤里的接口定义。',
      '判断标准很简单：这个文件里不能出现 DeepSeek 字样，也不能出现 prompt_tokens、choices 这类供应商字段。',
      'stream 返回 AsyncGenerator<string>，不要返回数组，否则流式能力就退化了。',
      'Message 类型只定义一次，其他文件用 import type 复用，避免两份同名类型互相不兼容。',
      'ChatOptions 里 signal 用可选的 AbortSignal；温度、最大 token 这类参数由调用方决定，接口只负责透传。',
    ].join('\n'),
    verify: [
      'provider.ts 里 grep 不到 DeepSeek',
      'ChatProvider 同时有 chat 和 stream',
      'npx tsc --noEmit 通过',
    ],
  },
  'p1-t7-provider/p1-t7-s2': {
    approach: [
      '新建 src/lib/deepseek-provider.ts，implements ChatProvider，name 设为 deepseek。',
      '把 callChatMessages 的 fetch 逻辑与 deepseek-stream 的解析逻辑搬进两个方法，再把 cli.ts 里 Conversation 的第一个参数换成 new DeepSeekProvider()。',
      'usage 映射成 promptTokens 与 completionTokens，业务层不需要知道原始字段名。',
      '错误统一抛 ProviderError：一个继承 Error 的类，构造函数接收 status 和 message，方便上层判断 429 或超时。',
      '构造时读取 .env 一次并存成私有字段，方便测试时替换；导入路径记得写 .js。',
    ].join('\n'),
    verify: [
      'cli.ts 切换到新 Provider 后行为不变',
      '错误对象上有 status 字段',
      '业务层 grep 不到直接调用 fetch',
    ],
  },
  'p1-t7-provider/p1-t7-s3': {
    approach: [
      '新建 src/lib/mock-provider.ts，抄步骤里的实现。',
      'replies 用 shift 消费队列，队列空了返回固定串，保证测试不会因为次数不对而崩。',
      'calls 里存 [...messages] 副本而不是引用，否则后续 push 会污染断言。',
      'stream 按字符 yield，用来测试流式拼接；也可以加一个 delayMs 选项模拟慢响应。',
      '想测失败路径，再暴露一个 errors 队列，chat 时优先抛错。',
    ].join('\n'),
    verify: [
      '两次 chat 后 calls.length 为 2',
      'calls[0] 不包含第二轮才出现的消息',
      'stream 拼接结果等于 chat 返回的 content',
    ],
  },
  'p1-t7-provider/p1-t7-s4': {
    approach: [
      '执行 npm i -D vitest，在 package.json 加 "test": "vitest run"。',
      '测试放 src/lib/conversation.test.ts；步骤里的只测 MockProvider 队列，还要补一条对话历史断言。',
      '补测做法：new MockProvider(["first", "second"]) 配 Conversation，依次 chat("a")、chat("b")，断言 calls[1] 含 { role: "assistant", content: "first" }。',
      '断言用 toHaveLength、toBe、toContainEqual 这类精确匹配，不要只断言 truthy。',
      '运行 npx vitest run，看到 passed 后把输出贴进任务记录。',
    ].join('\n'),
    commands: ['npm i -D vitest', 'npx vitest run'],
    verify: [
      'npx vitest run 显示全部通过',
      '故意改坏一个断言能看到 failed 并说明差异',
      '断网运行测试仍然通过（说明没有真实请求）',
    ],
  },
  'p1-t8-acceptance/p1-t8-s1': {
    approach: [
      '在 src/cli.ts 里用 process.argv.slice(2) 取第一个参数，switch 分发 chat、plan、usage。',
      '没有参数或未知参数时打印三行用法，并把 process.exitCode 设为 1。',
      'chat 复用多轮流式对话；plan 调用 JSON 模式加 parseWithRepair；usage 复用 03 脚本的汇总逻辑。',
      '把汇总逻辑从 labs 抽到 src/lib/usage-report.ts 再被两处引用，避免入口里堆代码。',
      '入口只做参数分发与错误提示，不读 key、不拼请求体。',
    ].join('\n'),
    commands: ['npx tsx src/cli.ts', 'npx tsx src/cli.ts usage'],
    verify: [
      '不带参数时打印用法且退出码为 1',
      'chat、plan、usage 三个子命令都能正常运行',
      'src 目录里 grep -i "sk-" 没有结果',
    ],
  },
  'p1-t8-acceptance/p1-t8-s2': {
    approach: [
      '场景 A：npx tsx src/cli.ts chat，先给一个名字，再追问「我叫什么」，确认上下文生效。',
      '场景 B：npx tsx src/cli.ts plan，确认输出通过 Zod 校验，打印 steps 数量应在 3 到 7 之间。',
      '场景 C：用 DEEPSEEK_API_KEY=bad-key 前缀运行，确认得到含 401 的可读错误，且没有打印堆栈中的敏感信息。',
      '每个场景保存命令原文与 5 到 10 行输出摘要，存进验收记录。',
      '顺手确认 logs/calls.jsonl 新增了三条记录，说明账本在工作。',
    ].join('\n'),
    commands: [
      'npx tsx src/cli.ts chat',
      'npx tsx src/cli.ts plan',
      'DEEPSEEK_API_KEY=bad-key npx tsx src/cli.ts chat',
    ],
    verify: [
      '三个场景都有命令与真实输出片段',
      '异常输出里没有 sk- 开头的字符串',
      '场景 B 的 steps 数量在 3 到 7 之间',
      '账本新增了对应记录',
    ],
  },
  'p1-t8-acceptance/p1-t8-s3': {
    approach: [
      '打开学习平台的阶段一验收页，逐项对照，只勾选有输出证据的条目。',
      '粘贴三类证据：可复制执行的命令、关键输出片段、vitest 通过数量。',
      '再写一段「最大问题」，例如 SSE 分包导致中文乱码、401 排查过程，写清现象、定位、修复三步。',
      '阶段完成度要 100%，需要回到任务列表把未完成的步骤逐个勾选，缺证据的补做而不是跳过。',
      '提交前刷新页面，确认验收记录已保存且能看到附件。',
    ].join('\n'),
    verify: [
      '验收记录里的命令能直接复制执行',
      '至少有一条失败到修复的完整记录',
      '阶段进度显示 100%',
    ],
  },
};
