"use client";
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, RotateCcw, Trash2, Plus, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Feed = {
  id: string;
  name: string;
  url: string;
  type: "RSS" | "WEB";
  enabled: boolean;
  _count?: { articles: number };
  feedbackCounts: { correct: number; rejected: number };
};

type CrawlFeedback = {
  id: string;
  articleId: string;
  verdict: "CORRECT" | "REJECTED";
  origin: "USER" | "SYSTEM";
  titleSnapshot: string;
  linkSnapshot: string;
  discoveredFromUrl: string;
  updatedAt: string;
};

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"RSS" | "WEB">("RSS");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null);
  const [feedbackByFeed, setFeedbackByFeed] = useState<Record<string, CrawlFeedback[]>>({});

  async function readResponse(res: Response) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `HTTP ${res.status}` };
  }

  async function load() {
    const res = await fetch("/api/feeds");
    const data = await readResponse(res);
    if (res.ok) setFeeds(data); else setStatus(data.error || "读取失败");
  }

  async function addFeed(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setStatus("");
    try {
      const res = await fetch("/api/feeds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url, type }) });
      const data = await readResponse(res);
      if (res.ok) { setName(""); setUrl(""); setType("RSS"); setStatus("已添加"); await load(); }
      else setStatus(data.error || "添加失败");
    } catch (e) { setStatus(String(e)); }
    finally { setLoading(false); }
  }

  async function batchAdd() {
    setLoading(true); setStatus("");
    const lines = batchText.split("\n").filter(l => l.trim());
    const items = lines.map(line => {
      const parts = line.split(",").map(s => s.trim());
      return { name: parts[0] || "", url: parts[1] || "", type: (parts[2] || "").toUpperCase() === "WEB" ? "WEB" : "RSS" };
    }).filter(item => item.name && item.url);
    if (items.length === 0) { setStatus("没有有效条目"); setLoading(false); return; }
    try {
      const res = await fetch("/api/feeds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) });
      const data = await readResponse(res);
      setBatchText("");
      setStatus(`已添加 ${data.created || 0} 个信息源`);
      await load();
    } catch (e) { setStatus(String(e)); }
    finally { setLoading(false); }
  }

  async function toggleFeed(feed: Feed) { await fetch(`/api/feeds/${feed.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !feed.enabled }) }); await load(); }
  async function removeFeed(feed: Feed) { await fetch(`/api/feeds/${feed.id}`, { method: "DELETE" }); await load(); }
  async function refreshOne(feed: Feed) { setLoading(true); setStatus(`正在抓取 ${feed.name}...`); const res = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedId: feed.id }) }); const data = await res.json(); setStatus(`${feed.name}: 新增 ${data.created} 条标题`); setLoading(false); await load(); }

  async function toggleFeedback(feed: Feed) {
    if (expandedFeedId === feed.id) {
      setExpandedFeedId(null);
      return;
    }
    setExpandedFeedId(feed.id);
    const res = await fetch(`/api/feeds/${feed.id}/feedback`);
    const data = await readResponse(res);
    if (res.ok) setFeedbackByFeed((current) => ({ ...current, [feed.id]: data }));
    else setStatus(data.error || "读取抓取反馈失败");
  }

  async function clearFeedback(feedId: string, articleId: string) {
    const res = await fetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crawlVerdict: null })
    });
    const data = await readResponse(res);
    if (!res.ok) {
      setStatus(data.error || "撤销反馈失败");
      return;
    }
    setFeedbackByFeed((current) => ({
      ...current,
      [feedId]: (current[feedId] || []).filter((item) => item.articleId !== articleId)
    }));
    await load();
  }

  useEffect(() => { load(); }, []);

  return (<>
    <div className="topbar"><div><h2 className="page-title">信息源管理</h2><p className="page-desc">添加 RSS 或网页信息源。批量添加：每行一个，格式：名称,URL[,RSS|WEB]</p></div></div>
    <section className="panel">
      <form className="form-grid" onSubmit={addFeed}>
        <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="来源名称" />
        <select className="select" value={type} onChange={e => setType(e.target.value as "RSS"|"WEB")}><option value="RSS">RSS / Atom</option><option value="WEB">普通网页</option></select>
        <input className="field" value={url} onChange={e => setUrl(e.target.value)} placeholder="RSS 或网页 URL" />
        <button className="button" disabled={loading}>添加</button>
      </form>
      <div style={{ marginBottom: 16 }}>
        <textarea className="textarea" value={batchText} onChange={e => setBatchText(e.target.value)} placeholder={"批量添加：每行一个\n名称,URL,RSS\n名称,URL,WEB"} rows={4} style={{ marginBottom: 8 }} />
        <button className="button secondary" onClick={batchAdd} disabled={loading}><Plus size={16} />批量添加</button>
      </div>
      {status ? <p className="status">{status}</p> : null}
      <div className="feed-list">
        {feeds.length === 0 ? <div className="empty">还没有信息源。添加 RSS 或网页栏目后即可开始抓取标题。</div> :
          feeds.map(feed => (
            <div className="feed-item" key={feed.id}>
              <div><strong>{feed.name}</strong><div className="feed-url">{feed.url}</div><div className="status">{feed.type} | {feed.enabled ? "已启用" : "已停用"} | {feed._count?.articles || 0} 条标题</div></div>
              <button className="button secondary" onClick={() => refreshOne(feed)} disabled={loading || !feed.enabled}><RefreshCw size={16} />抓取</button>
              <button className="button secondary" onClick={() => toggleFeed(feed)}>{feed.enabled ? "停用" : "启用"}</button>
              <button className="button ghost" onClick={() => removeFeed(feed)}><Trash2 size={16} /></button>
              <button className="button secondary feed-feedback-toggle" onClick={() => toggleFeedback(feed)}>
                {expandedFeedId === feed.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                抓取反馈：正确 {feed.feedbackCounts?.correct || 0} / 错误 {feed.feedbackCounts?.rejected || 0}
              </button>
              {expandedFeedId === feed.id ? (
                <div className="feed-feedback-list">
                  {(feedbackByFeed[feed.id] || []).length === 0 ? (
                    <div className="empty feedback-empty">这个网站还没有抓取反馈。</div>
                  ) : (feedbackByFeed[feed.id] || []).map((feedback) => (
                    <div className="feedback-item" key={feedback.id}>
                      <div className="feedback-verdict">
                        {feedback.verdict === "CORRECT" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        {feedback.verdict === "CORRECT" ? "抓取正确" : "不应抓取"}
                        {feedback.origin === "SYSTEM" ? <span className="tag">系统识别</span> : null}
                      </div>
                      <div>
                        <a className="article-title" href={feedback.linkSnapshot} target="_blank" rel="noreferrer">
                          {feedback.titleSnapshot}
                        </a>
                        <div className="feed-url">发现页面：{feedback.discoveredFromUrl || "旧记录"}</div>
                      </div>
                      <button className="button secondary" onClick={() => clearFeedback(feed.id, feedback.articleId)}>
                        <RotateCcw size={16} />撤销
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>))
        }
      </div>
    </section>
  </>);
}
