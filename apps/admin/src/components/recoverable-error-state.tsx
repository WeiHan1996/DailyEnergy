"use client";

import { useState } from "react";

import { StatePanel } from "./state-panel";

export function RecoverableErrorState() {
  const [recovered, setRecovered] = useState(false);

  if (recovered) {
    return (
      <StatePanel
        description="连接已恢复。业务数据页面将在后续任务中接入。"
        eyebrow="Empty"
        kind="empty"
        title="暂时没有可展示的数据"
      />
    );
  }

  return (
    <StatePanel
      action={
        <button
          className="button button--primary"
          onClick={() => {
            setRecovered(true);
          }}
          type="button"
        >
          重试
        </button>
      }
      description="本次读取没有完成。可以安全重试；不会创建第二份业务事实。"
      eyebrow="Recoverable Error"
      kind="error"
      title="暂时无法读取"
    />
  );
}
