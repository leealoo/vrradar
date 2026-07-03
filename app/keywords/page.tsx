"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type TagRule = {
  id: string;
  category: "COMPANY" | "TOPIC";
  label: string;
  keywords: string[];
};

type SearchKeyword = {
  id: string;
  keyword: string;
};

type KeywordPayload = {
  tagRules: TagRule[];
  savedSearchKeywords: SearchKeyword[];
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data ? String(data.error) : `请求失败：${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export default function KeywordsPage() {
  const [tagRules, setTagRules] = useState<TagRule[]>([]);
  const [savedSearchKeywords, setSavedSearchKeywords] = useState<SearchKeyword[]>([]);
  const [category, setCategory] = useState<"COMPANY" | "TOPIC">("COMPANY");
  const [label, setLabel] = useState("");
  const [keywords, setKeywords] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/keywords");
      const data = await readJson<KeywordPayload>(res);
      setTagRules(data.tagRules);
      setSavedSearchKeywords(data.savedSearchKeywords);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/keywords/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label, keywords: keywords.split(",") })
      });
      await readJson<TagRule>(res);
      setStatus("标签规则已添加");
      setLabel("");
      setKeywords("");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveRule(rule: TagRule) {
    setLoading(true);
    try {
      const res = await fetch(`/api/keywords/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule)
      });
      await readJson<TagRule>(res);
      setStatus("标签规则已保存");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/keywords/rules/${id}`, { method: "DELETE" });
      await readJson<{ ok?: boolean }>(res);
      setStatus("标签规则已删除");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function addSearchKeyword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/keywords/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: searchKeyword })
      });
      await readJson<SearchKeyword>(res);
      setStatus("常用搜索词已添加");
      setSearchKeyword("");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSearchKeyword(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/keywords/search/${id}`, { method: "DELETE" });
      await readJson<{ ok?: boolean }>(res);
      setStatus("常用搜索词已删除");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function retag() {
    setLoading(true);
    setStatus("正在重新扫描历史标题...");
    try {
      const res = await fetch("/api/retag", { method: "POST" });
      const data = await readJson<{ updated: number }>(res);
      setStatus(`已重新打标签 ${data.updated} 条标题`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">关键词管理</h2>
          <p className="page-desc">维护自动标签词库和标题列表里的常用搜索词。</p>
        </div>
        <button className="button secondary" disabled={loading} onClick={retag}>
          <RefreshCw size={16} />
          重新打标签
        </button>
      </div>

      <section className="split-grid">
        <div className="panel stack">
          <h3>自动标签词库</h3>
          <form className="stack" onSubmit={addRule}>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as "COMPANY" | "TOPIC")}>
              <option value="COMPANY">公司</option>
              <option value="TOPIC">主题</option>
            </select>
            <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="标签名称，如 Meta" />
            <input className="field" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="匹配关键词，用英文逗号分隔" />
            <button className="button" disabled={loading}>添加标签</button>
          </form>

          <div className="stack">
            {tagRules.map((rule) => (
              <div className="rule-item" key={rule.id}>
                <select className="select" value={rule.category} onChange={(event) => setTagRules((current) => current.map((item) => (item.id === rule.id ? { ...item, category: event.target.value as "COMPANY" | "TOPIC" } : item)))}>
                  <option value="COMPANY">公司</option>
                  <option value="TOPIC">主题</option>
                </select>
                <input className="field" value={rule.label} onChange={(event) => setTagRules((current) => current.map((item) => (item.id === rule.id ? { ...item, label: event.target.value } : item)))} />
                <input
                  className="field"
                  value={rule.keywords.join(", ")}
                  onChange={(event) =>
                    setTagRules((current) =>
                      current.map((item) =>
                        item.id === rule.id
                          ? { ...item, keywords: event.target.value.split(",").map((keyword) => keyword.trim()).filter(Boolean) }
                          : item
                      )
                    )
                  }
                />
                <div className="inline-actions">
                  <button className="button secondary" onClick={() => saveRule(rule)} disabled={loading}>保存</button>
                  <button className="button ghost" onClick={() => deleteRule(rule.id)} title="删除标签" disabled={loading}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel stack">
          <h3>常用搜索词</h3>
          <form className="stack" onSubmit={addSearchKeyword}>
            <input className="field" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="如 Vision Pro" />
            <button className="button" disabled={loading}>添加搜索词</button>
          </form>
          <div className="quick-row">
            {savedSearchKeywords.map((item) => (
              <span className="tag" key={item.id}>
                {item.keyword}
                <button className="button ghost" onClick={() => deleteSearchKeyword(item.id)} title="删除搜索词" disabled={loading}>
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
          </div>
          {status ? <p className="status">{status}</p> : null}
        </div>
      </section>
    </>
  );
}
