"use client";

import { format } from "date-fns";
import { Languages, RefreshCw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseTags } from "@/lib/tags";

type Article = {
  id: string;
  title: string;
  translatedTitle: string;
  link: string;
  source: string;
  publishedAt: string | null;
  companyTags: string;
  topicTags: string;
  favorite: boolean;
  note: string;
  createdAt: string;
};

type Props = { mode: "today" | "all" | "favorites" };

type KeywordPayload = {
  tagRules: Array<{ id: string; category: "COMPANY" | "TOPIC"; label: string; keywords: string[] }>;
  savedSearchKeywords: Array<{ id: string; keyword: string }>;
};

type TranslateBatchResult = {
  translated: number;
  total: number;
  failed?: number;
  remaining?: number;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data ? String(data.error) : `请求失败：${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function translateStatus(data: TranslateBatchResult) {
  const failedText = data.failed ? `，失败 ${data.failed} 条` : "";
  const remainingText = data.remaining ? `，剩余 ${data.remaining} 条待重试` : "";
  return `已翻译 ${data.translated}/${data.total}${failedText}${remainingText}`;
}

export function ArticleList({ mode }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [keywords, setKeywords] = useState<KeywordPayload>({ tagRules: [], savedSearchKeywords: [] });
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [translating, setTranslating] = useState(false);
  const autoTranslateStarted = useRef(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (date) params.set("date", date);
    if (company) params.set("company", company);
    if (topic) params.set("topic", topic);
    if (mode === "favorites") params.set("favorite", "true");
    if (mode === "today") params.set("days", "3");
    return params.toString();
  }, [company, date, mode, q, topic]);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/articles?${query}`);
      setArticles(await readJson<Article[]>(res));
      if (!quiet) setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setArticles([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadKeywords() {
    try {
      const res = await fetch("/api/keywords");
      setKeywords(await readJson<KeywordPayload>(res));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function refresh() {
    setLoading(true);
    setStatus("正在抓取信息源标题...");
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await readJson<{ checkedFeeds: number; created: number }>(res);
      setStatus(`已检查 ${data.checkedFeeds} 个信息源，新增 ${data.created} 条标题`);
      await load(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function translateAll() {
    setTranslating(true);
    setStatus("正在翻译所有未翻译标题...");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await readJson<TranslateBatchResult>(res);
      setStatus(translateStatus(data));
      await load(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setTranslating(false);
    }
  }

  async function autoTranslateUntilDone() {
    if (autoTranslateStarted.current) return;
    autoTranslateStarted.current = true;

    while (true) {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const data = await readJson<TranslateBatchResult>(res);
        if (data.total > 0) {
          setStatus(`自动翻译：${translateStatus(data)}`);
          await load(true);
        }
        if (!data.remaining) break;
        await new Promise((resolve) => setTimeout(resolve, data.translated > 0 ? 1000 : 30000));
      } catch {
        break;
      }
    }
  }

  async function translateOne(id: string) {
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: id })
      });
      const data = await readJson<{ translatedTitle?: string }>(res);
      if (data.translatedTitle) {
        setArticles((current) => current.map((article) => (article.id === id ? { ...article, translatedTitle: data.translatedTitle! } : article)));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function updateArticle(id: string, patch: Partial<Pick<Article, "favorite" | "note">>) {
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const updated = await readJson<Article>(res);
      setArticles((current) => current.map((article) => (article.id === id ? updated : article)).filter((article) => (mode === "favorites" ? article.favorite : true)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  useEffect(() => {
    void loadKeywords();
  }, []);

  useEffect(() => {
    void autoTranslateUntilDone();
  }, []);

  const companies = keywords.tagRules.filter((rule) => rule.category === "COMPANY").map((rule) => rule.label);
  const topics = keywords.tagRules.filter((rule) => rule.category === "TOPIC").map((rule) => rule.label);

  const grouped = useMemo(() => {
    if (mode !== "today") return null;
    const groups: Record<string, Article[]> = {};
    for (const article of articles) {
      const key = article.publishedAt ? format(new Date(article.publishedAt), "yyyy-MM-dd") : format(new Date(article.createdAt), "yyyy-MM-dd");
      if (!groups[key]) groups[key] = [];
      groups[key].push(article);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [articles, mode]);

  return (
    <section className="panel">
      <div className="toolbar">
        <input className="field" value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索标题关键词" />
        {mode !== "today" && <input type="date" className="field" value={date} onChange={(event) => setDate(event.target.value)} />}
        <select className="select" value={company} onChange={(event) => setCompany(event.target.value)}>
          <option value="">全部公司</option>
          {companies.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="select" value={topic} onChange={(event) => setTopic(event.target.value)}>
          <option value="">全部主题</option>
          {topics.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="button" onClick={mode === "today" ? refresh : () => load()} disabled={loading}>
          {mode === "today" ? <RefreshCw size={16} /> : <Search size={16} />}
          {mode === "today" ? "抓取更新" : "搜索"}
        </button>
        {mode === "today" && (
          <button className="button secondary" onClick={translateAll} disabled={translating}>
            <Languages size={16} />
            翻译
          </button>
        )}
      </div>

      {keywords.savedSearchKeywords.length ? (
        <div className="quick-row">
          {keywords.savedSearchKeywords.map((item) => <button className="chip-button" key={item.id} onClick={() => setQ(item.keyword)}>{item.keyword}</button>)}
        </div>
      ) : null}

      {status ? <p className="status">{status}</p> : null}

      <div className="article-list">
        {articles.length === 0 ? (
          <div className="empty">{loading ? "加载中..." : "暂无标题。可以先去信息源管理添加 RSS，再回到今日更新抓取。"}</div>
        ) : mode === "today" && grouped ? (
          grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <h3 style={{ margin: "12px 0 8px", color: "var(--accent)", fontSize: 16 }}>{dateKey}（{items.length} 条）</h3>
              {items.map((article) => renderArticle(article))}
            </div>
          ))
        ) : (
          articles.map((article) => renderArticle(article))
        )}
      </div>
    </section>
  );

  function renderArticle(article: Article) {
    const companyTags = parseTags(article.companyTags);
    const topicTags = parseTags(article.topicTags);
    return (
      <article className="article" key={article.id}>
        <div className="article-head">
          <div>
            <a className="article-title" href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
            {article.translatedTitle && <div className="translated-title">{article.translatedTitle}</div>}
            <div className="meta">
              <span>{article.source}</span>
              <span>{article.publishedAt ? format(new Date(article.publishedAt), "yyyy-MM-dd HH:mm") : "未标注时间"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!article.translatedTitle && (
              <button className="button secondary" onClick={() => translateOne(article.id)} title="翻译">
                <Languages size={16} />
              </button>
            )}
            <button className={article.favorite ? "button" : "button secondary"} onClick={() => updateArticle(article.id, { favorite: !article.favorite })} title={article.favorite ? "取消收藏" : "收藏"}>
              <Star size={16} fill={article.favorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        <div className="tags">
          {companyTags.map((item) => <span className="tag company" key={item}>{item}</span>)}
          {topicTags.map((item) => <span className="tag" key={item}>{item}</span>)}
        </div>
        <div className="note-row">
          <textarea className="textarea" value={article.note} onChange={(event) => setArticles((current) => current.map((item) => (item.id === article.id ? { ...item, note: event.target.value } : item)))} placeholder="添加人工备注" />
          <button className="button secondary" onClick={() => updateArticle(article.id, { note: article.note })}>保存备注</button>
        </div>
      </article>
    );
  }
}
