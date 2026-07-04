"use client";

import { Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";

const exportTypes = [
  { value: "today", label: "今日标题池" },
  { value: "weekly-favorites", label: "本周收藏标题" },
  { value: "company", label: "按公司分类标题" }
];

export default function ExportPage() {
  const [type, setType] = useState("today");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("");

  async function loadMarkdown(nextType = type) {
    const res = await fetch(`/api/export?type=${nextType}`);
    const data = await res.json();
    setMarkdown(data.markdown || "");
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    setStatus("Markdown 已复制到剪贴板");
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `vr-radar-${type}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }

  useEffect(() => {
    loadMarkdown(type);
  }, [type]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">Markdown 导出</h2>
          <p className="page-desc">把标题池整理成可以直接进入写作流程的 Markdown。</p>
        </div>
      </div>
      <section className="export-grid">
        <div className="panel export-options">
          {exportTypes.map((item) => (
            <button
              className={type === item.value ? "button" : "button secondary"}
              key={item.value}
              onClick={() => setType(item.value)}
            >
              {item.label}
            </button>
          ))}
          <button className="button secondary" onClick={copyMarkdown}>
            <Copy size={16} />
            复制
          </button>
          <button className="button secondary" onClick={downloadMarkdown}>
            <Download size={16} />
            下载 .md
          </button>
          {status ? <p className="status">{status}</p> : null}
        </div>
        <div className="panel">
          <textarea className="textarea markdown-box" value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
        </div>
      </section>
    </>
  );
}
