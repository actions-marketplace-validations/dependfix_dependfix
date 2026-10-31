---
name: documentation-specialist
description: 查阅、生成、更新、对齐和审校项目文档时使用。适用于 README、设计说明、变更说明、技能文档、计划文档与规范文档，也覆盖文档治理、规范瘦身、归档索引化与 docs/plan 结构整理；不假设文档一定在 docs/ 目录下。用户提到 docs、documentation、README、设计文档、同步文档、更新说明、文档治理、归档整理、规范瘦身时都应触发。
metadata:
  internal: true
---

# Documentation Specialist

铁律：不要把文档写成愿景或猜测。文档必须反映代码、配置和决策的当前事实。

## 工作流

- [ ] Step 1: 确认文档类型 ⚠️ REQUIRED
	- [ ] 1.1 判断这是规范文档、设计说明、使用说明、变更记录还是技能文档。
	- [ ] 1.2 明确读者是谁，以及文档需要回答什么问题。
- [ ] Step 2: 收集权威来源 ⚠️ REQUIRED
	- [ ] 2.1 从代码、配置、现有文档和提交意图中提取事实。
	- [ ] 2.2 当事实不充分时，先标记未知点，不要自行脑补。
- [ ] Step 3: 组织内容
	- [ ] 3.1 先写结构，再补细节、命令、示例和链接。
	- [ ] 3.2 需要交叉引用时，保证路径和标题真实可用。
- [ ] Step 4: 做同步检查
	- [ ] 4.1 核对文档是否与当前代码和工作流一致。
	- [ ] 4.2 如果代码已变更但文档无法完整更新，明确写出缺口。

## 项目文档治理（周期执行）

当任务涉及文档体量、归档顺序、规范条文或「文档需要治理一下」时，按 [文档治理执行规范](../../../docs/design/governance/doc-governance.md) 执行；本节是可直接勾选的执行清单。

### 触发

- 每次阶段归档：跑门禁并处理 blocker / freshness warning。
- 每 5 个阶段或连续 2 个阶段出现预算 warning。
- `check:doc-governance` 进入阻断列、归档索引失序、用户报告文档不可信。

### 执行清单

- [ ] 1. 冻结：`git status --short` 干净；记录 `git rev-list --count HEAD ^origin/master`。
- [ ] 2. 盘点：`pnpm run check:doc-governance` + `pnpm run check:doc-size`；把实测字符 / 条数 / 归档行数写进批次记录，禁止估算。
- [ ] 3. 分类：逐文件按处置矩阵标记「保留 / 压缩 / 迁 Note / 迁归档 / 改指针 / 退役」，每条写明证据（行号、字符数、重复位置）。
- [ ] 4. 排批：一个 commit 一个逻辑变更；本体与引用面重指同批，禁止中间态死链；按 `planning.md §1.1` 控制规模。
- [ ] 5. 执行：迁移正文优先 `git mv`；拆分/合并按 `^##` 边界切片；压缩保留「规则 + 触发 + 执行」，原因/案例迁 `engineering-practice-notes.md` 或经验归档；归档正文只迁不删。
- [ ] 6. 重指：`rg -n 'todo-archive\.md#|archive/index\.md#|development\.md#5\.1\.'` + `pnpm run check:docs`；锚点以 `docs:build` 产物 id 为准。
- [ ] 7. 验证：`check:doc-governance` / `check:doc-size` / `check:docs` / `check:orphan-ids` / `check:standards-redundant:strict` / `check:experience-landing` / `lint:md:check` / `docs:build` 全 exit 0；脚本改动加跑定向 vitest。
- [ ] 8. 审计与登记：A 阶段独立审计（治理定义改动默认 `standard`，> 10 文件 / > 800 行 `deep`）；在本文件 §10 批次记录追加一行；提交走 `conventional-committer`，不得自动 push。

### 规则处置口径

- 可机检 → L1：脚本 / 测试 / CI，必须给出负例（植入违规必须 exit 1）。
- 需人工判断 → L2：写清「触发改动」与「检查动作」，挂 review 检查点矩阵；无触发面的不留在规范。
- 只解释原因 / 实现细节 → Note：`docs/design/governance/engineering-practice-notes.md`，不作为放行依据。
- 一次性事故 / 环境噪音 → Archive：经验归档。

### 硬边界

- 不删除归档正文；不把生成物留在 `docs/`；不新增「只写规则、不给执行方式」的严格约束。
- 归档索引以 `todo-archive.md` 为唯一入口，阶段正文在 `docs/plan/archive/todo-archive-phases-*.md`；批次流水账在 `archive-log.md`。
- 规范文件超字符 / 条数预算时先迁移细节，不得只缩字号或调高阈值。

## 关注点

- 标题是否准确反映读者任务。
- 示例命令是否真实可执行。
- 链接、路径、技能名和脚本名是否存在。
- 文档是否说明限制、前提和后续动作。

## 项目特化提示

- 如果仓库中存在 docs/，优先检查 standards/、design/、plan/ 等子目录，而不是假设所有文档都在根目录。
- 需要图表时优先使用 Mermaid，而不是嵌入难维护的图片描述。
- 当代码或技能流程发生重大变化时，优先更新 README、设计文档和技能文档中的命令与路径。

## 反模式

- 假设 docs/ 一定存在，并围绕不存在的目录写文档。
- 复制代码结构却不解释为什么这样设计。
- 用口号替代操作步骤和限制条件。

## 交付前检查

- [ ] 文档结论都有代码、配置或既有文档作为依据。
- [ ] 路径、链接、技能名和命令都已核对。
- [ ] 已明确文档面向的读者和使用场景。
- [ ] 未把未知信息伪装成既定事实。









