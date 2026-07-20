(() => {
  "use strict";

  const app = document.querySelector("#app");
  const banner = document.querySelector("#system-banner");
  const demoPanel = document.querySelector("#demo-panel");
  const demoBackdrop = document.querySelector("#demo-backdrop");
  const scenarioList = document.querySelector("#scenario-list");
  const confirmModal = document.querySelector("#confirm-modal");
  const modalBackdrop = document.querySelector("#modal-backdrop");
  const toast = document.querySelector("#toast");

  const scenarios = [
    { id: "new", label: "新用户首次体验", detail: "承接、认识、签到、生成、行动与点亮" },
    { id: "returning", label: "当日回访", detail: "同一内容、已点亮与任务状态" },
    { id: "evening", label: "晚间回看", detail: "18:00 后入口、反馈和修改" },
    { id: "trend2", label: "2 天记录", detail: "只展示记录，不判断趋势" },
    { id: "trend5", label: "5 天记录", detail: "标注“基于 5 天”的局部趋势" },
    { id: "trend7", label: "7 天回望", detail: "完整周窗口与真实数据来源" },
    { id: "offline", label: "离线缓存", detail: "内容可读，所有写操作禁用" },
    { id: "fallback", label: "完整模板降级", detail: "结构完整，用户端无技术提示" },
    { id: "personalization", label: "个性化暂不可用", detail: "仅显示一条中性内联说明" },
    { id: "error", label: "局部可恢复错误", detail: "保留今日内容，原位重试" },
    { id: "delete", label: "删除历史日", detail: "一次确认并说明趋势影响" },
    { id: "safety", label: "Safety 全屏替代", detail: "隐藏普通导航与娱乐内容" }
  ];

  const toneExamples = {
    gentle: {
      name: "温柔",
      copy: "昨晚休息得不算充足。今天先守住最重要的一件事，其他安排慢一点也没关系。"
    },
    light: {
      name: "轻松幽默",
      copy: "今天电量有点保守，先别让十件事同时在后台运行。挑一件最重要的做完。"
    },
    direct: {
      name: "清醒直接",
      copy: "你今天精力偏低。保留最重要的一件事，取消一个非必要安排。"
    }
  };

  const checkinOptions = {
    mood: ["很低落", "有点低落", "平稳", "还不错", "很轻松", "说不准"],
    energy: ["快没电", "偏低", "一般", "充足", "很充足", "说不准"],
    sleep: ["很差", "不太好", "还可以", "很好", "说不准"]
  };

  const state = {};
  let generationTimer = null;
  let toastTimer = null;
  let dangerAction = null;
  let lastFocusedElement = null;

  function baseState() {
    return {
      scenario: "new",
      screen: "landing",
      history: [],
      nickname: "",
      tone: "balanced",
      checkin: { mood: null, energy: null, sleep: null },
      generated: false,
      reachedAction: false,
      dimensionsExpanded: false,
      lit: false,
      task: "none",
      helpful: null,
      feedback: { feeling: null, helpful: null, task: null, note: "", completed: false },
      late: false,
      recordDays: 2,
      offline: false,
      templateFallback: false,
      personalizationLimited: false,
      recoverableError: false,
      deletedDay: false,
      memory: {
        title: "周五的项目汇报",
        date: "7 月 24 日",
        mention: true,
        reminder: false,
        active: true
      },
      deleting: false,
      deleted: false
    };
  }

  function resetState(scenarioId = "new") {
    if (generationTimer) {
      window.clearTimeout(generationTimer);
      generationTimer = null;
    }
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, baseState(), { scenario: scenarioId });

    switch (scenarioId) {
      case "returning":
        Object.assign(state, {
          screen: "today",
          nickname: "林溪",
          tone: "gentle",
          generated: true,
          reachedAction: true,
          lit: true,
          task: "trying"
        });
        break;
      case "evening":
        Object.assign(state, {
          screen: "today",
          nickname: "林溪",
          tone: "gentle",
          generated: true,
          reachedAction: true,
          lit: true,
          task: "done",
          late: true
        });
        break;
      case "trend2":
      case "trend5":
      case "trend7":
        Object.assign(state, {
          screen: "records",
          nickname: "林溪",
          generated: true,
          lit: true,
          recordDays: Number(scenarioId.replace("trend", ""))
        });
        break;
      case "offline":
        Object.assign(state, {
          screen: "today",
          nickname: "林溪",
          generated: true,
          reachedAction: true,
          lit: true,
          task: "trying",
          offline: true
        });
        break;
      case "fallback":
        Object.assign(state, {
          screen: "today",
          generated: true,
          reachedAction: true,
          templateFallback: true
        });
        break;
      case "personalization":
        Object.assign(state, {
          screen: "today",
          nickname: "林溪",
          generated: true,
          reachedAction: true,
          personalizationLimited: true
        });
        break;
      case "error":
        Object.assign(state, {
          screen: "today",
          nickname: "林溪",
          generated: true,
          reachedAction: true,
          recoverableError: true
        });
        break;
      case "delete":
        Object.assign(state, {
          screen: "history-day",
          nickname: "林溪",
          generated: true,
          lit: true,
          recordDays: 5
        });
        break;
      case "safety":
        Object.assign(state, { screen: "safety" });
        break;
      default:
        break;
    }

    render();
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayName() {
    return state.nickname.trim() ? escapeHtml(state.nickname.trim()) : "你";
  }

  function navigate(screen, { replace = false, focus = true } = {}) {
    if (!replace && state.screen !== screen) state.history.push(state.screen);
    state.screen = screen;
    render();
    if (focus) requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }

  function goBack() {
    if (state.screen === "safety") return;
    const previous = state.history.pop();
    state.screen = previous || (state.generated ? "today" : "landing");
    render();
    requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }

  function topbar(title, right = "") {
    return `
      <header class="topbar">
        <button class="icon-button" type="button" data-action="back" aria-label="返回">‹</button>
        <div class="topbar-title">${escapeHtml(title)}</div>
        ${right || '<span aria-hidden="true"></span>'}
      </header>
    `;
  }

  function renderLanding() {
    return `
      <section class="screen screen--landing screen--center" aria-labelledby="landing-title">
        <div class="hero-mark" aria-hidden="true">日</div>
        <p class="eyebrow">DailyEnergy</p>
        <h2 id="landing-title" class="screen-title">每天一分钟，<br />有个朋友陪你看看今天。</h2>
        <p class="screen-copy">选一下此刻状态，听一句合适的话，再带走一个今天做得到的小行动。</p>
        <div class="landing-promise" aria-label="体验步骤">
          <div class="promise-step"><span>1</span><span>十秒看看真实状态</span></div>
          <div class="promise-step"><span>2</span><span>收到稳定的今日参考</span></div>
          <div class="promise-step"><span>3</span><span>只选一件做得到的事</span></div>
        </div>
        <button class="button button--block" type="button" data-action="start">开始今天的一分钟</button>
        <p class="boundary-note">今日能量用于娱乐、反思与日常行动参考，不替你预测未来或提供专业结论。</p>
      </section>
    `;
  }

  function renderToneCards() {
    return Object.entries(toneExamples)
      .map(([id, tone]) => {
        const selected = state.tone === id;
        return `
          <button class="tone-card" type="button" data-action="select-tone" data-value="${id}" aria-pressed="${selected}" ${state.offline ? "disabled" : ""}>
            <span class="tone-card__head">
              <span>${tone.name}</span>
              <span class="tone-card__check" aria-hidden="true">${selected ? "✓" : ""}</span>
            </span>
            <p>${tone.copy}</p>
          </button>
        `;
      })
      .join("");
  }

  function renderOnboarding() {
    return `
      <section class="screen" aria-labelledby="onboarding-title">
        ${topbar("第一次认识")}
        <p class="eyebrow">大约 10 秒</p>
        <h2 id="onboarding-title" class="screen-title">先告诉我，怎样和你相处更合适。</h2>
        <div class="field">
          <label for="nickname">怎样称呼你</label>
          <input id="nickname" class="text-input" maxlength="20" autocomplete="off" value="${escapeHtml(state.nickname)}" placeholder="可不填" />
          <span class="field-hint">留空时，我会自然使用“你”或省略称呼，不会替你编一个昵称。</span>
        </div>
        <div class="field">
          <span class="group-label">我怎样说话更合适</span>
          <span class="field-hint">三种示例说的是同一件事，只改变表达方式。</span>
        </div>
        <div class="tone-list">${renderToneCards()}</div>
        <p class="field-hint">不选择也可以，将使用温暖、清醒的默认平衡方式；以后随时能改。</p>
        <div class="sticky-action">
          <button class="button button--block" type="button" data-action="finish-onboarding">继续看今天</button>
        </div>
      </section>
    `;
  }

  function renderChoiceGroup(group, label, options, columns = "") {
    return `
      <fieldset class="choice-group" style="border:0;padding:0">
        <legend class="group-label">${label}</legend>
        <div class="choice-grid ${columns}">
          ${options
            .map((option, index) => {
              const uncertain = option === "说不准";
              const selected = state.checkin[group] === option;
              return `
                <button
                  class="choice ${uncertain ? "choice--uncertain" : ""}"
                  type="button"
                  data-action="select-checkin"
                  data-group="${group}"
                  data-value="${option}"
                  aria-pressed="${selected}"
                >${option}</button>
              `;
            })
            .join("")}
        </div>
      </fieldset>
    `;
  }

  function renderCheckin() {
    const complete = Object.values(state.checkin).every(Boolean);
    return `
      <section class="screen" aria-labelledby="checkin-title">
        ${topbar("今天 · 7 月 20 日")}
        <span class="content-label content-label--real">你的真实状态</span>
        <h2 id="checkin-title" class="screen-title">现在的你，比较接近哪一种？</h2>
        <p class="screen-copy">没有标准答案，“说不准”也算一个完整回答。</p>
        ${renderChoiceGroup("mood", "此刻心情", checkinOptions.mood)}
        ${renderChoiceGroup("energy", "现在精力", checkinOptions.energy)}
        ${renderChoiceGroup("sleep", "昨晚睡眠", checkinOptions.sleep, "choice-grid--four")}
        <div class="sticky-action">
          <button class="button button--block" type="button" data-action="submit-checkin" ${complete ? "" : "disabled"}>
            ${complete ? "生成今天" : "选完三项后生成"}
          </button>
        </div>
      </section>
    `;
  }

  function renderGenerating() {
    return `
      <section class="screen screen--center generation" aria-labelledby="generating-title">
        <div class="generation-orbit" aria-hidden="true"><div class="generation-core">日</div></div>
        <h2 id="generating-title">正在整理你刚刚选择的状态</h2>
        <p>今天的内容生成后会保持不变。这里没有神秘计算，也不会因为刷新而重新抽取。</p>
        <button class="text-button" type="button" data-action="skip-generation">稍后再来看</button>
      </section>
    `;
  }

  function todayCopy() {
    if (state.templateFallback) {
      return {
        greeting: "早上好，先把今天过得简单一点。",
        explanation: "你的精力不算满，但行动状态还在。今天更适合减少来回切换，把能量集中在一件真正重要的事上。"
      };
    }
    return {
      greeting: `${displayName() === "你" ? "早上好" : `${displayName()}，早上好`}。今天先稳住自己的节奏。`,
      explanation: "你昨晚休息得不算充足，但行动状态还在。与其把安排全部推翻，不如先保护精力最好的那一小段时间。"
    };
  }

  function renderToday() {
    const copy = todayCopy();
    const writeDisabled = state.offline ? "disabled" : "";
    const lightDisabled = !state.reachedAction || state.offline ? "disabled" : "";
    const dimensions = [
      ["行动", "适合先做最重要的第一步", "不错"],
      ["情绪", "给情绪留一点缓冲", "平稳"],
      ["社交", "重要表达先确认重点", "平稳"],
      ["财富", "适合按计划，不追逐冲动", "平稳"],
      ["健康", "减少切换，照顾真实体感", "需留意"]
    ];
    const visibleDimensions = state.dimensionsExpanded ? dimensions : dimensions.slice(0, 1);

    return `
      <section class="screen" aria-labelledby="today-title">
        <header class="today-head">
          <div>
            <p class="eyebrow">7 月 20 日 · 周一</p>
            <h2 id="today-title" class="greeting">${copy.greeting}</h2>
          </div>
          <div class="today-head__actions">
            <button class="icon-button" type="button" data-action="go-records" aria-label="查看记录">◷</button>
            <button class="icon-button" type="button" data-action="go-settings" aria-label="打开设置">⋯</button>
          </div>
        </header>

        <span class="content-label">娱乐与行动参考</span>
        <div class="energy-hero">
          <div class="energy-score"><strong>72</strong><span>整体能量 · 稳中有进</span></div>
          <div class="focus-dimension"><span>今日重点 · 行动</span><span>78 · 不错</span></div>
          <p class="focus-copy">别同时推进很多事。先让最重要的那一件真正开始。</p>
        </div>

        ${
          state.personalizationLimited
            ? `<div class="system-card" role="status"><p>今天先用基础内容陪你完成这一分钟，之前记下的个性化信息暂时没有加入。</p></div>`
            : ""
        }
        ${
          state.recoverableError
            ? `<div class="system-card" role="status"><h3>五维详情暂时没加载完整</h3><p>今日重点、行动和点亮都还在。你可以原位重试，不需要重新生成。</p><button class="text-button" type="button" data-action="retry-error">重试五维详情</button></div>`
            : ""
        }

        <div class="section">
          <h3 class="section-heading">为什么是这个重点</h3>
          <p class="section-copy">${copy.explanation}</p>
        </div>

        <div class="section" id="action-section">
          <div class="action-card">
            <span class="action-kicker">今天只做这一件</span>
            <h3>在上午精力最好时，先完成汇报的前三句话。</h3>
            <p>控制在二十分钟内。先开始，不要求一次写完。</p>
          </div>
          <div class="task-card">
            <div class="task-card__head"><strong>可选小任务</strong><span class="field-hint">不影响点亮</span></div>
            <p>开始前，关掉一个不需要的通知入口。</p>
            <div class="task-options" aria-label="小任务状态">
              ${taskChip("trying", "想试试")}
              ${taskChip("done", "已完成")}
              ${taskChip("skip", "今天先不做")}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="light-card ${state.lit ? "light-card--completed" : ""}">
            <div class="light-symbol" aria-hidden="true">${state.lit ? "✦" : "○"}</div>
            <h3>${state.lit ? "今天已经留下来了" : "把今天轻轻留下"}</h3>
            <p>${state.lit ? "点亮只代表你看过今天的重点。" : "到达主要行动后即可点亮，不需要先完成任务。"}</p>
            ${
              state.lit
                ? `<span class="completion-note">✓ 7 月 20 日已点亮</span>`
                : `<button id="light-button" class="button button--block" type="button" data-action="light-day" ${lightDisabled}>${state.offline ? "联网后可点亮" : state.reachedAction ? "点亮今天" : "看到行动后可点亮"}</button>`
            }
          </div>
        </div>

        <div class="section">
          <div class="card-head"><h3 class="section-heading">五维状态</h3><span class="field-hint">娱乐参考</span></div>
          <div class="dimension-list">
            ${visibleDimensions
              .map(
                ([name, detail, level]) => `
                  <div class="dimension-row">
                    <strong>${name}</strong><span>${detail}</span><span class="dimension-level">${level}</span>
                  </div>`
              )
              .join("")}
          </div>
          <button class="text-button" type="button" data-action="toggle-dimensions" ${state.recoverableError ? "disabled" : ""}>
            ${state.dimensionsExpanded ? "收起其余四项" : "展开其余四项"}
          </button>
          ${
            state.dimensionsExpanded
              ? `<div class="entertainment-row"><div class="entertainment-item">幸运色<strong>松针绿</strong></div><div class="entertainment-item">幸运数字<strong>4</strong></div></div>`
              : ""
          }
        </div>

        <div class="section feedback-card">
          <h3>这条建议有用吗？</h3>
          <div class="feedback-options">
            ${helpChip("yes", "有帮助")}${helpChip("neutral", "一般")}${helpChip("no", "没帮助")}
          </div>
        </div>

        ${renderRelationshipCard()}
        ${renderEveningCard()}

        <div class="link-list" aria-label="更多入口">
          <button class="link-row" type="button" data-action="go-records"><span>最近 7 天记录</span><span>真实变化 ›</span></button>
          <button class="link-row" type="button" data-action="go-evening"><span>${state.late ? "回看今天" : "现在回看今天"}</span><span>${state.late ? "晚间入口" : "可提前记录"} ›</span></button>
          <button class="link-row" type="button" data-action="preview-share"><span>分享今日一句话</span><span>先预览 ›</span></button>
        </div>

        ${
          !state.reachedAction
            ? `<div class="sticky-action"><button class="button button--block" type="button" data-action="show-action">看看今天怎么做</button></div>`
            : ""
        }
      </section>
    `;
  }

  function taskChip(value, label) {
    return `<button class="chip" type="button" data-action="set-task" data-value="${value}" aria-pressed="${state.task === value}" ${state.offline ? "disabled" : ""}>${label}</button>`;
  }

  function helpChip(value, label) {
    return `<button class="chip" type="button" data-action="set-helpful" data-value="${value}" aria-pressed="${state.helpful === value}" ${state.offline ? "disabled" : ""}>${label}</button>`;
  }

  function renderRelationshipCard() {
    if (state.scenario === "returning") {
      return `
        <div class="section relation-card">
          <p class="eyebrow">第 3 天 · 表达校准</p>
          <h3>这几天我说话的方式合适吗？</h3>
          <div class="task-options">
            <button class="chip" type="button" data-action="calibrate-tone" data-value="balanced">正合适</button>
            <button class="chip" type="button" data-action="calibrate-tone" data-value="gentle">再温柔一点</button>
            <button class="chip" type="button" data-action="calibrate-tone" data-value="direct">更直接一点</button>
          </div>
        </div>
      `;
    }
    if (state.scenario === "trend7") {
      return `
        <div class="section relation-card">
          <p class="eyebrow">第 7 天 · 第一段共同记录</p>
          <h3>你已经留下了一些真实片段。</h3>
          <p>不用连续完美，也能回头看看这一周。</p>
          <button class="text-button" type="button" data-action="go-records">查看七天回望</button>
        </div>
      `;
    }
    return "";
  }

  function renderEveningCard() {
    if (!state.late && state.scenario !== "evening") return "";
    return `
      <div class="section relation-card">
        <p class="eyebrow">你的真实记录</p>
        <h3>${state.feedback.completed ? "今晚的记录还可以修改" : "晚一点，回头看看真实的一天"}</h3>
        <p>${state.feedback.completed ? "已经保存，不需要写长日记。" : "大约十秒，可跳过任何非必要项。"}</p>
        <button class="text-button" type="button" data-action="go-evening">${state.feedback.completed ? "修改记录" : "回看今天"}</button>
      </div>
    `;
  }

  function renderEvening() {
    const complete = state.feedback.feeling && state.feedback.helpful && state.feedback.task;
    return `
      <section class="screen" aria-labelledby="evening-title">
        ${topbar("回看今天")}
        <span class="content-label content-label--real">你的真实记录</span>
        <h2 id="evening-title" class="screen-title">今天真实过得怎么样？</h2>
        <p class="screen-copy">不是给今日能量打分，只是留下你自己的感受。</p>
        ${eveningGroup("feeling", "整体感觉", ["很累", "有点累", "平稳", "还不错", "很轻松", "说不准"])}
        ${eveningGroup("helpful", "建议帮助度", ["有帮助", "一般", "没帮助", "没有用到"])}
        ${eveningGroup("task", "小任务结果", ["已完成", "想试试", "今天没做"])}
        <div class="field">
          <label for="evening-note">最想留下一句话 <span class="field-hint">（可不填）</span></label>
          <textarea id="evening-note" class="text-area" maxlength="80" placeholder="今天有什么想留住的片段？" ${state.offline ? "disabled" : ""}>${escapeHtml(state.feedback.note)}</textarea>
          <span class="field-hint">最多 80 字；本原型不会保存或上传。</span>
        </div>
        ${state.feedback.completed ? `<div class="completion-note">✓ 已保存演示记录，可在今天结束前修改</div>` : ""}
        <div class="sticky-action">
          <button class="button button--block" type="button" data-action="save-evening" ${complete && !state.offline ? "" : "disabled"}>
            ${state.offline ? "联网后可保存" : state.feedback.completed ? "保存修改" : "保存今天"}
          </button>
        </div>
      </section>
    `;
  }

  function eveningGroup(group, label, options) {
    return `
      <fieldset class="choice-group" style="border:0;padding:0">
        <legend class="group-label">${label}</legend>
        <div class="option-list">
          ${options
            .map(
              (option) => `
                <button class="choice" type="button" data-action="select-evening" data-group="${group}" data-value="${option}" aria-pressed="${state.feedback[group] === option}" ${state.offline ? "disabled" : ""}>${option}</button>`
            )
            .join("")}
        </div>
      </fieldset>
    `;
  }

  function recordSeries() {
    const values = [42, 48, 44, 58, 62, 57, 66];
    return values.map((value, index) => (index >= 7 - state.recordDays && !(state.recordDays === 7 && index === 3) ? value : null));
  }

  function renderRecords() {
    const values = recordSeries();
    const sampleCount = values.filter((value) => value !== null).length;
    const summary =
      state.recordDays <= 2
        ? "留下的记录还不多，先只看见这两天，不急着判断上升或下降。"
        : state.recordDays < 7
          ? `基于 ${sampleCount} 天记录：后半段精力略有回升；缺少的日期不会被补齐。`
          : "这一周的后半段精力比前半段更稳定。周四没有记录，因此不参与趋势判断。";
    const days = ["周二", "周三", "周四", "周五", "周六", "周日", "今天"];

    return `
      <section class="screen" aria-labelledby="records-title">
        ${topbar("最近 7 天")}
        <span class="content-label content-label--real">你的真实记录</span>
        <h2 id="records-title" class="screen-title">看看这几天真实留下了什么。</h2>
        <p class="screen-copy">7 月 14 日—7 月 20 日 · 基于 ${sampleCount} 天记录</p>
        <div class="record-summary">
          <div class="summary-tile"><strong>${sampleCount}</strong><span>有记录的日子</span></div>
          <div class="summary-tile"><strong>${Math.max(1, sampleCount - 1)}</strong><span>点亮的日子</span></div>
        </div>
        <div class="trend-card">
          <div class="trend-card__head"><strong>晨间精力</strong><span>真实选择，不是今日能量</span></div>
          <div class="trend-bars" role="img" aria-label="七天晨间精力，${sampleCount} 天有记录，其余缺失">
            ${values
              .map(
                (value) => `<div class="trend-bar ${value === null ? "trend-bar--missing" : ""}" style="height:${value === null ? 4 : value}%"></div>`
              )
              .join("")}
          </div>
          <div class="trend-days">${days.map((day) => `<span>${day}</span>`).join("")}</div>
          <p class="trend-note">${summary}</p>
        </div>
        <div class="section">
          <h3 class="section-heading">最近日记录</h3>
          <div class="record-list">
            ${values
              .map((value, index) => {
                const missing = value === null || (state.deletedDay && index === 5);
                return `
                  <button class="record-row ${missing ? "record-row--missing" : ""}" type="button" ${missing ? "disabled" : 'data-action="go-history"'}>
                    <strong>${days[index]}</strong>
                    <span>${missing ? "没有留下记录" : `精力 ${value} · ${index % 2 ? "已点亮" : "未点亮"}`}</span>
                    <span>${missing ? "—" : "›"}</span>
                  </button>`;
              })
              .reverse()
              .join("")}
          </div>
        </div>
        ${
          state.recordDays >= 7
            ? `<div class="section relation-card"><p class="eyebrow">第一段七天回望</p><h3>你不需要每天都状态很好。</h3><p>真实记录显示，精力在后半周慢慢回升；对你更有帮助的建议，往往是缩小任务，而不是继续加码。缺少的周四没有被推断。</p><button class="text-button" type="button" data-action="show-sources">查看数据来源</button></div>`
            : `<div class="section system-card"><h3>${state.recordDays <= 2 ? "还不到判断趋势的时候" : "完整七天回望还在形成"}</h3><p>${state.recordDays <= 2 ? "再留下几天真实记录后，才会出现局部趋势。" : "达到七天窗口后会生成完整回望；不会补造缺失日。"}</p></div>`
        }
      </section>
    `;
  }

  function renderHistoryDay() {
    return `
      <section class="screen" aria-labelledby="history-title">
        ${topbar("7 月 19 日 · 周日")}
        <h2 id="history-title" class="screen-title">这一天留下的记录</h2>
        <div class="section real-panel">
          <span class="content-label content-label--real">你的真实记录</span>
          <h3 class="section-heading">早晨状态</h3>
          <div class="summary-row"><span>心情</span><strong>平稳</strong></div>
          <div class="summary-row"><span>精力</span><strong>一般</strong></div>
          <div class="summary-row"><span>睡眠</span><strong>还可以</strong></div>
        </div>
        <div class="section energy-hero">
          <span class="content-label">当时的娱乐与行动参考</span>
          <div class="energy-score"><strong>68</strong><span>整体能量 · 平稳</span></div>
          <p class="focus-copy">把计划缩小一点，让真正重要的事先发生。</p>
        </div>
        <div class="section action-card"><span class="action-kicker">当时的行动</span><h3>整理下一周最需要先确认的一件事。</h3><p>这份内容保持当时版本，不按今天的规则重新生成。</p></div>
        <div class="section real-panel">
          <span class="content-label content-label--real">晚间真实记录</span>
          <div class="summary-row"><span>整体感觉</span><strong>还不错</strong></div>
          <div class="summary-row"><span>建议帮助度</span><strong>有帮助</strong></div>
          <div class="summary-row"><span>任务</span><strong>今天没做</strong></div>
        </div>
        <div class="danger-zone">
          <h3>删除这一天</h3>
          <p>会删除这天的签到、今日内容、点亮、任务和晚间反馈，并让七天趋势重新计算。</p>
          <button class="text-button text-button--danger" type="button" data-action="delete-day" ${state.offline ? "disabled" : ""}>删除 7 月 19 日记录</button>
        </div>
      </section>
    `;
  }

  function renderSettings() {
    return `
      <section class="screen" aria-labelledby="settings-title">
        ${topbar("设置")}
        <h2 id="settings-title" class="screen-title">设置</h2>
        <p class="screen-copy">偏好、记忆和数据权利都在这里。没有角色商城，也不能重抽今天。</p>
        <div class="link-list">
          <button class="setting-row" type="button" data-action="go-preferences"><span>资料与表达偏好</span><span>${state.tone === "balanced" ? "默认平衡" : toneExamples[state.tone]?.name || "默认平衡"} ›</span></button>
          <button class="setting-row" type="button" data-action="go-memories"><span>重要事项</span><span>${state.memory.active ? "1 件有效" : "暂无"} ›</span></button>
          <button class="setting-row" type="button" data-action="show-reminder"><span>提醒</span><span>未开启 ›</span></button>
          <button class="setting-row" type="button" data-action="go-privacy"><span>隐私与数据</span><span>查看和删除 ›</span></button>
          <button class="setting-row" type="button" data-action="show-about"><span>帮助、反馈与关于</span><span>产品边界 ›</span></button>
        </div>
      </section>
    `;
  }

  function renderPreferences() {
    return `
      <section class="screen" aria-labelledby="preferences-title">
        ${topbar("资料与表达偏好")}
        <h2 id="preferences-title" class="screen-title">让表达更贴近你。</h2>
        <div class="field">
          <label for="nickname">称呼</label>
          <input id="nickname" class="text-input" maxlength="20" value="${escapeHtml(state.nickname)}" placeholder="可不填" ${state.offline ? "disabled" : ""} />
          <span class="field-hint">留空时自然使用“你”或省略称呼。</span>
        </div>
        <div class="field"><span class="group-label">表达方式</span><span class="field-hint">只影响之后的表达，不改变今天的核心结果。</span></div>
        <div class="tone-list">${renderToneCards()}</div>
        <div class="sticky-action"><button class="button button--block" type="button" data-action="save-preferences" ${state.offline ? "disabled" : ""}>${state.offline ? "联网后可保存" : "保存"}</button></div>
      </section>
    `;
  }

  function renderMemories() {
    return `
      <section class="screen" aria-labelledby="memories-title">
        ${topbar("重要事项")}
        <p class="eyebrow">你主动让我记住的事</p>
        <h2 id="memories-title" class="screen-title">重要事项</h2>
        <p class="screen-copy">完全可选。这里不会展示从普通文字中自动推断的隐藏记忆。</p>
        ${
          state.memory.active
            ? `<button class="memory-card button--block" type="button" data-action="go-memory-edit" style="text-align:left;color:inherit"><h3>${escapeHtml(state.memory.title)}</h3><p>${state.memory.date} · 可在每日内容中自然提及</p><div class="memory-meta"><span class="meta-pill">用户主动添加</span><span class="meta-pill">有效</span></div></button>`
            : `<div class="system-card"><h3>还没有重要事项</h3><p>你可以从今天开始，也可以一直不添加。</p></div>`
        }
        <button class="button button--secondary button--block" type="button" data-action="go-memory-edit" ${state.offline ? "disabled" : ""} style="margin-top:16px">新增一件事</button>
      </section>
    `;
  }

  function renderMemoryEdit() {
    return `
      <section class="screen" aria-labelledby="memory-edit-title">
        ${topbar(state.memory.active ? "编辑重要事项" : "新增重要事项")}
        <h2 id="memory-edit-title" class="screen-title">记录一件近期在意的事。</h2>
        <p class="screen-copy">只在你允许的方式和合适的时间使用，不预测结果。</p>
        <div class="field"><label for="memory-title">事项</label><input id="memory-title" class="text-input" maxlength="40" value="${escapeHtml(state.memory.title)}" placeholder="例如：周五的项目汇报" ${state.offline ? "disabled" : ""} /></div>
        <div class="field"><label for="memory-date">日期（可选）</label><input id="memory-date" class="text-input" value="${escapeHtml(state.memory.date)}" placeholder="例如：7 月 24 日" ${state.offline ? "disabled" : ""} /></div>
        ${switchRow("mention", "允许在每日内容中提及", "只在合适时自然引用，不承诺结果", state.memory.mention)}
        ${switchRow("reminder", "提醒我", "需要单独申请微信提醒权限", state.memory.reminder)}
        <div class="sticky-action"><button class="button button--block" type="button" data-action="save-memory" ${state.offline ? "disabled" : ""}>保存</button></div>
        ${state.memory.active ? `<div class="danger-zone"><h3>删除事项</h3><p>删除后不再进入后续内容。</p><button class="text-button text-button--danger" type="button" data-action="delete-memory">删除这件事</button></div>` : ""}
      </section>
    `;
  }

  function switchRow(id, label, detail, checked) {
    return `
      <div class="switch-row">
        <span><strong>${label}</strong><small>${detail}</small></span>
        <button class="switch" type="button" role="switch" aria-label="${label}" aria-checked="${checked}" data-action="toggle-memory" data-key="${id}" ${state.offline ? "disabled" : ""}></button>
      </div>
    `;
  }

  function renderPrivacy() {
    return `
      <section class="screen" aria-labelledby="privacy-title">
        ${topbar("隐私与数据")}
        <h2 id="privacy-title" class="screen-title">你的数据，你可以看见和控制。</h2>
        <p class="screen-copy">原型只展示结构，不保存或传输任何输入。</p>
        <div class="section privacy-card"><h3>收集与用途</h3><p>称呼和表达偏好用于调整表达；签到和晚间反馈用于当天内容与真实趋势；重要事项只在你允许时使用。</p></div>
        <div class="link-list">
          <button class="setting-row" type="button" data-action="go-memories"><span>查看重要事项</span><span>1 件 ›</span></button>
          <button class="setting-row" type="button" data-action="show-export"><span>导出我的数据</span><span>${state.offline ? "需联网" : "未申请"} ›</span></button>
          <button class="setting-row" type="button" data-action="go-records"><span>管理单日记录</span><span>最近 7 天 ›</span></button>
        </div>
        <div class="danger-zone">
          <h3>关系数据与账户</h3>
          <p>删除范围、处理时间与不可逆影响会在独立页面完整说明。</p>
          <button class="text-button text-button--danger" type="button" data-action="go-account-delete" ${state.offline ? "disabled" : ""}>删除关系数据或注销</button>
        </div>
      </section>
    `;
  }

  function renderAccountDelete() {
    return `
      <section class="screen" aria-labelledby="account-delete-title">
        ${topbar("删除与注销")}
        <p class="eyebrow">第一步 · 理解影响</p>
        <h2 id="account-delete-title" class="screen-title">结束关系数据或注销账户</h2>
        <div class="privacy-card"><h3>会删除</h3><p>个人资料、签到、今日内容、点亮、晚间反馈、重要事项及其它承诺删除的关系数据。</p></div>
        <div class="privacy-card"><h3>处理方式</h3><p>正式产品上线前会依据隐私规范明确处理时间、身份验证和依法保留的最小例外。本原型不作虚假期限承诺。</p></div>
        <div class="privacy-card"><h3>不可逆</h3><p>完成后不能通过返回查看已删除内容，也不会用连续记录或数字朋友情绪挽留你。</p></div>
        <button class="button button--danger button--block" type="button" data-action="confirm-account-delete" style="margin-top:24px">继续到最终确认</button>
        <button class="button button--quiet button--block" type="button" data-action="back" style="margin-top:8px">取消</button>
      </section>
    `;
  }

  function renderDeleting() {
    return `
      <section class="screen screen--center" aria-labelledby="deleting-title">
        <div class="generation" role="status">
          <div class="generation-orbit" aria-hidden="true"><div class="generation-core">删</div></div>
          <h2 id="deleting-title">正在处理删除请求</h2>
          <p>同一个请求不会重复创建。处理期间不能返回查看已承诺删除的数据。</p>
          <button class="button button--secondary" type="button" data-action="finish-delete" style="margin-top:22px">演示处理完成</button>
        </div>
      </section>
    `;
  }

  function renderDeleted() {
    return `
      <section class="screen screen--center" aria-labelledby="deleted-title">
        <p class="eyebrow">演示完成状态</p>
        <h2 id="deleted-title" class="screen-title">关系数据删除请求已完成。</h2>
        <p class="screen-copy">正式产品会同时清除对应本地缓存与会话。本原型没有真实数据被删除。</p>
        <button class="button button--block" type="button" data-action="reset-prototype" style="margin-top:24px">回到原型起点</button>
      </section>
    `;
  }

  function renderSafety() {
    return `
      <section class="screen screen--safe" aria-labelledby="safety-title">
        <div class="safe-mark" aria-hidden="true">!</div>
        <p class="eyebrow">现在先关注现实中的安全</p>
        <h2 id="safety-title" class="screen-title">如果你或他人正处于立即危险，请现在联系现实中的帮助。</h2>
        <p class="screen-copy">DailyEnergy 不能独立处理危机，也不会在这里继续显示今日能量、幸运内容或轻松任务。</p>
        <div class="safe-actions">
          <button class="button button--block" type="button" data-action="safe-emergency">联系当地紧急服务（原型占位）</button>
          <button class="button button--secondary button--block" type="button" data-action="safe-person">联系一位可信任的人</button>
        </div>
        <div class="section safe-resource"><strong>让一个现实中的人陪在你身边</strong><p>如果可以，去到有人在的安全位置，并清楚告诉对方你现在需要帮助。</p></div>
        <div class="safe-resource"><strong>地区资源仍需专业评审</strong><p>热线、机构和恢复条件将在后续安全规范中按地区维护；这里不使用未经审核的临时号码。</p></div>
        <p class="boundary-note">普通返回不会暴露刚才被替代的内容。可通过“演示”面板退出本原型场景。</p>
      </section>
    `;
  }

  function renderSharePreview() {
    return `
      <section class="screen" aria-labelledby="share-title">
        ${topbar("分享预览")}
        <p class="eyebrow">将公开这些内容</p>
        <h2 id="share-title" class="screen-title">分享前，先看清卡片。</h2>
        <div class="energy-hero" style="margin-top:20px">
          <p class="eyebrow">DailyEnergy · 今日一句话</p>
          <p class="focus-copy" style="margin-top:38px">别同时推进很多事。先让最重要的那一件真正开始。</p>
          <p class="boundary-note" style="text-align:left">娱乐与行动参考</p>
        </div>
        <div class="system-card"><h3>默认隐藏</h3><p>称呼、情绪、精力、睡眠、晚间文字和重要事项都不会出现在卡片中。</p></div>
        <button class="button button--block" type="button" data-action="fake-share" ${state.offline ? "disabled" : ""} style="margin-top:20px">${state.offline ? "联网后可分享" : "调用微信分享（原型）"}</button>
      </section>
    `;
  }

  function renderAbout() {
    return `
      <section class="screen" aria-labelledby="about-title">
        ${topbar("帮助与关于")}
        <h2 id="about-title" class="screen-title">DailyEnergy 是什么？</h2>
        <div class="system-card"><h3>每天一分钟的日常陪伴</h3><p>用真实状态、稳定的今日参考和一个小行动，帮你稍微整理一下今天。</p></div>
        <div class="system-card"><h3>今日能量是什么？</h3><p>一种娱乐与反思入口，不承诺预测未来，也不替你做重要决定。</p></div>
        <div class="system-card"><h3>它不是什么？</h3><p>不是心理治疗、医疗诊断、投资或法律服务，也不是无限聊天和虚拟恋爱产品。</p></div>
        <button class="button button--secondary button--block" type="button" data-action="show-feedback-form" style="margin-top:20px">反馈原型问题</button>
      </section>
    `;
  }

  function renderScreen() {
    switch (state.screen) {
      case "landing":
        return renderLanding();
      case "onboarding":
        return renderOnboarding();
      case "checkin":
        return renderCheckin();
      case "generating":
        return renderGenerating();
      case "today":
        return renderToday();
      case "evening":
        return renderEvening();
      case "records":
        return renderRecords();
      case "history-day":
        return renderHistoryDay();
      case "settings":
        return renderSettings();
      case "preferences":
        return renderPreferences();
      case "memories":
        return renderMemories();
      case "memory-edit":
        return renderMemoryEdit();
      case "privacy":
        return renderPrivacy();
      case "account-delete":
        return renderAccountDelete();
      case "deleting":
        return renderDeleting();
      case "deleted":
        return renderDeleted();
      case "safety":
        return renderSafety();
      case "share":
        return renderSharePreview();
      case "about":
        return renderAbout();
      default:
        return renderLanding();
    }
  }

  function renderBanner() {
    banner.hidden = true;
    banner.className = "system-banner";
    banner.textContent = "";

    if (state.offline) {
      banner.hidden = false;
      banner.classList.add("system-banner--offline");
      banner.textContent = "离线内容 · 最后同步于 09:32。阅读可继续，写入需联网。";
    } else if (state.recoverableError) {
      banner.hidden = false;
      banner.classList.add("system-banner--error");
      banner.textContent = "一个次要区域暂时不可用，今日重点仍可阅读。";
    }
  }

  function renderScenarioList() {
    scenarioList.innerHTML = scenarios
      .map(
        (scenario) => `
          <button class="scenario-button" type="button" data-action="select-scenario" data-value="${scenario.id}" aria-pressed="${state.scenario === scenario.id}">
            <span><strong>${scenario.label}</strong><small>${scenario.detail}</small></span>
            <span aria-hidden="true">${state.scenario === scenario.id ? "✓" : ""}</span>
          </button>
        `
      )
      .join("");
  }

  function render() {
    app.innerHTML = renderScreen();
    renderBanner();
    renderScenarioList();
    app.scrollTop = 0;

    if (state.screen === "generating" && !generationTimer) {
      generationTimer = window.setTimeout(() => {
        generationTimer = null;
        state.generated = true;
        state.screen = "today";
        render();
        app.focus({ preventScroll: true });
      }, 1250);
    }

    if (state.screen === "today" && !state.reachedAction) observeActionCard();
  }

  function observeActionCard() {
    const actionSection = document.querySelector("#action-section");
    if (!actionSection || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.4)) {
          state.reachedAction = true;
          const lightButton = document.querySelector("#light-button");
          if (lightButton && !state.offline) {
            lightButton.disabled = false;
            lightButton.textContent = "点亮今天";
          }
          observer.disconnect();
        }
      },
      { root: app, threshold: [0.4] }
    );
    observer.observe(actionSection);
  }

  function openDemoPanel() {
    lastFocusedElement = document.activeElement;
    demoPanel.hidden = false;
    demoBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    demoPanel.querySelector("button")?.focus();
  }

  function closeDemoPanel() {
    demoPanel.hidden = true;
    demoBackdrop.hidden = true;
    document.body.style.overflow = "";
    lastFocusedElement?.focus?.();
  }

  function openConfirm(config) {
    dangerAction = config;
    lastFocusedElement = document.activeElement;
    document.querySelector("#confirm-title").textContent = config.title;
    document.querySelector("#confirm-description").textContent = config.description;
    document.querySelector("#confirm-impact").textContent = config.impact;
    const confirmButton = confirmModal.querySelector('[data-action="confirm-danger"]');
    confirmButton.textContent = config.confirmLabel;
    confirmModal.hidden = false;
    modalBackdrop.hidden = false;
    confirmButton.focus();
  }

  function closeConfirm() {
    confirmModal.hidden = true;
    modalBackdrop.hidden = true;
    dangerAction = null;
    lastFocusedElement?.focus?.();
  }

  function showToast(message) {
    if (toastTimer) window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toastTimer = null;
    }, 2400);
  }

  function readInput(id) {
    return document.querySelector(`#${id}`)?.value?.trim() || "";
  }

  function handleDangerConfirm() {
    if (!dangerAction) return;
    const type = dangerAction.type;
    closeConfirm();
    if (type === "day") {
      state.deletedDay = true;
      state.recordDays = Math.max(1, state.recordDays - 1);
      navigate("records", { replace: true });
      showToast("7 月 19 日已在原型中删除，趋势样本已减少");
    } else if (type === "memory") {
      state.memory.active = false;
      state.memory.title = "";
      state.memory.date = "";
      navigate("memories", { replace: true });
      showToast("事项已在原型中删除，后续不再使用");
    } else if (type === "account") {
      state.deleting = true;
      state.history = [];
      navigate("deleting", { replace: true });
    }
  }

  function handleAction(action, element) {
    switch (action) {
      case "open-demo-panel":
        openDemoPanel();
        break;
      case "close-demo-panel":
        closeDemoPanel();
        break;
      case "select-scenario":
        closeDemoPanel();
        resetState(element.dataset.value);
        break;
      case "reset-prototype":
        closeDemoPanel();
        resetState(state.scenario === "new" ? "new" : state.scenario);
        break;
      case "back":
        goBack();
        break;
      case "start":
        navigate("onboarding");
        break;
      case "select-tone":
        state.tone = element.dataset.value;
        render();
        break;
      case "finish-onboarding":
        state.nickname = readInput("nickname");
        navigate("checkin");
        break;
      case "select-checkin":
        state.checkin[element.dataset.group] = element.dataset.value;
        render();
        break;
      case "submit-checkin":
        if (Object.values(state.checkin).every(Boolean)) navigate("generating");
        break;
      case "skip-generation":
        if (generationTimer) window.clearTimeout(generationTimer);
        generationTimer = null;
        state.generated = true;
        navigate("today", { replace: true });
        break;
      case "show-action":
        state.reachedAction = true;
        render();
        requestAnimationFrame(() => document.querySelector("#action-section")?.scrollIntoView({ behavior: "smooth" }));
        break;
      case "toggle-dimensions":
        state.dimensionsExpanded = !state.dimensionsExpanded;
        render();
        requestAnimationFrame(() => document.querySelector(".dimension-list")?.scrollIntoView({ block: "center" }));
        break;
      case "set-task":
        if (!state.offline) {
          state.task = element.dataset.value;
          render();
          showToast(state.task === "done" ? "已记录完成；这不是点亮条件" : "已记录，不影响点亮");
        }
        break;
      case "light-day":
        if (state.reachedAction && !state.offline) {
          state.lit = true;
          render();
          showToast("今天已经留下来了");
        }
        break;
      case "set-helpful":
        if (!state.offline) {
          state.helpful = element.dataset.value;
          render();
          showToast(element.dataset.value === "no" ? "收到，不需要勉强执行" : "已记录你的反馈");
        }
        break;
      case "calibrate-tone":
        state.tone = element.dataset.value === "balanced" ? "balanced" : element.dataset.value;
        showToast("只会影响之后的表达");
        break;
      case "go-records":
        if (state.recordDays < 2) state.recordDays = 2;
        navigate("records");
        break;
      case "go-settings":
        navigate("settings");
        break;
      case "go-evening":
        navigate("evening");
        break;
      case "select-evening":
        state.feedback[element.dataset.group] = element.dataset.value;
        render();
        break;
      case "save-evening":
        if (!state.offline && state.feedback.feeling && state.feedback.helpful && state.feedback.task) {
          state.feedback.note = readInput("evening-note");
          state.feedback.completed = true;
          state.late = true;
          navigate("today", { replace: true });
          showToast("今晚的真实记录已保存，可在今天结束前修改");
        }
        break;
      case "retry-error":
        state.recoverableError = false;
        render();
        showToast("五维详情已恢复；今日结果没有改变");
        break;
      case "go-history":
        navigate("history-day");
        break;
      case "delete-day":
        openConfirm({
          type: "day",
          title: "删除 7 月 19 日记录？",
          description: "这是一次明确确认，不会再用情绪化文案挽留。",
          impact: "会删除签到、今日内容、点亮、任务和晚间反馈；七天趋势样本数将减少并重新计算。",
          confirmLabel: "删除这一天"
        });
        break;
      case "cancel-danger":
        closeConfirm();
        break;
      case "confirm-danger":
        handleDangerConfirm();
        break;
      case "go-preferences":
        navigate("preferences");
        break;
      case "save-preferences":
        if (!state.offline) {
          state.nickname = readInput("nickname");
          goBack();
          showToast("偏好已在原型中更新；今天的核心结果不变");
        }
        break;
      case "go-memories":
        navigate("memories");
        break;
      case "go-memory-edit":
        navigate("memory-edit");
        break;
      case "toggle-memory":
        if (!state.offline) {
          const key = element.dataset.key;
          state.memory[key] = !state.memory[key];
          render();
        }
        break;
      case "save-memory":
        if (!state.offline) {
          const title = readInput("memory-title");
          if (!title) {
            showToast("请写下事项，或返回取消");
            break;
          }
          state.memory.title = title;
          state.memory.date = readInput("memory-date") || "未设置日期";
          state.memory.active = true;
          navigate("memories", { replace: true });
          showToast("已记录；只会按你允许的方式使用");
        }
        break;
      case "delete-memory":
        openConfirm({
          type: "memory",
          title: "删除这件重要事项？",
          description: "删除后，它不会再出现在后续内容中。",
          impact: "事项文字、日期和使用许可将删除；已经生成的历史内容不会被重新改写。",
          confirmLabel: "删除这件事"
        });
        break;
      case "go-privacy":
        navigate("privacy");
        break;
      case "go-account-delete":
        navigate("account-delete");
        break;
      case "confirm-account-delete":
        openConfirm({
          type: "account",
          title: "最终确认删除关系数据？",
          description: "正式产品在此之前还会按需重新验证身份。",
          impact: "该操作不可逆。处理期间不能访问承诺删除的数据；不会用连续记录、优惠或数字朋友情绪阻止你。",
          confirmLabel: "确认删除关系数据"
        });
        break;
      case "finish-delete":
        state.deleting = false;
        state.deleted = true;
        navigate("deleted", { replace: true });
        break;
      case "preview-share":
        navigate("share");
        break;
      case "fake-share":
        showToast("原型不调用真实微信分享；生成不等于已分享");
        break;
      case "show-reminder":
        showToast("提醒是 P1；拒绝授权不影响今日体验");
        break;
      case "show-export":
        showToast(state.offline ? "离线时不能发起导出" : "原型不创建真实导出任务");
        break;
      case "show-about":
        navigate("about");
        break;
      case "show-feedback-form":
        showToast("原型不会提交外部反馈或附带敏感内容");
        break;
      case "show-sources":
        showToast("来源：7 天晨间选择、点亮、任务和晚间反馈；缺失日不推断");
        break;
      case "safe-emergency":
      case "safe-person":
        showToast("这是界面理解占位，不会发起真实电话或消息");
        break;
      default:
        break;
    }
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element || element.disabled) return;
    handleAction(element.dataset.action, element);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "nickname") state.nickname = event.target.value;
    if (event.target.id === "evening-note") state.feedback.note = event.target.value;
    if (event.target.id === "memory-title") state.memory.title = event.target.value;
    if (event.target.id === "memory-date") state.memory.date = event.target.value;
  });

  demoBackdrop.addEventListener("click", closeDemoPanel);
  modalBackdrop.addEventListener("click", closeConfirm);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!confirmModal.hidden) closeConfirm();
    else if (!demoPanel.hidden) closeDemoPanel();
  });

  resetState("new");
})();
