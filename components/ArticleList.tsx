"use client";

import { format } from "date-fns";
import { CheckCircle2, Languages, RefreshCw, Search, Star, StarOff, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  readNdjsonStream,
  type RefreshProgressSnapshot,
  type RefreshResult,
  type RefreshStreamMessage
} from "@/lib/refreshProgress";
import { parseTags } from "@/lib/tags";

type Article = {
  id: string;
  title: string;
  translatedTitle: string;
  link: string;
  source: string;
  publishedAt: string | null;
  publishedAtSource: "FEED" | "PAGE" | "CRAWLED" | "UNKNOWN";
  companyTags: string;
  topicTags: string;
  favorite: boolean;
  deleted: boolean;
  crawlVerdict: "CORRECT" | "REJECTED" | null;
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

type BatchAction = "delete" | "favorite" | "unfavorite" | "mark-correct" | "mark-rejected" | "clear-feedback";

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

function formatPublishedAt(article: Article) {
  if (!article.publishedAt) return "未标注时间";
  const label = format(new Date(article.publishedAt), "yyyy-MM-dd HH:mm");
  return article.publishedAtSource === "CRAWLED" ? `${label}（抓取时间）` : label;
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
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgressSnapshot | null>(null);
  const [translating, setTranslating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      setSelectedIds(new Set());
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
    setRefreshProgress({
      stage: "starting",
      totalFeeds: 0,
      completedFeeds: 0,
      remainingFeeds: 0,
      created: 0,
      currentFeed: null
    });
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson"
        },
        body: JSON.stringify({ stream: true })
      });

      if (!res.ok) await readJson(res);
      if (!res.body) throw new Error("浏览器未提供抓取进度流");

      let result: RefreshResult | null = null;
      let streamError = "";
      await readNdjsonStream<RefreshStreamMessage>(res.body, (message) => {
        if (message.type === "progress") setRefreshProgress(message.progress);
        if (message.type === "complete") result = message.result;
        if (message.type === "error") streamError = message.message;
      });

      if (streamError) throw new Error(streamError);
      if (!result) throw new Error("抓取进度流意外结束");

      const finalResult = result as RefreshResult;
      const failureText = finalResult.errors.length ? `，失败 ${finalResult.errors.length} 个` : "";
      setStatus(`已检查 ${finalResult.checkedFeeds} 个信息源，新增 ${finalResult.created} 条标题${failureText}`);
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

  async function updateArticle(id: string, patch: Partial<Pick<Article, "favorite" | "deleted" | "crawlVerdict">>) {
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const updated = await readJson<Article>(res);
      setArticles((current) => current
        .map((article) => (article.id === id ? updated : article))
        .filter((article) => !article.deleted && article.crawlVerdict !== "REJECTED" && (mode === "favorites" ? article.favorite : true)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteArticle(id: string) {
    await updateArticle(id, { deleted: true });
  }

  function toggleArticleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (articles.length > 0 && current.size === articles.length) return new Set();
      return new Set(articles.map((article) => article.id));
    });
  }

  async function batchUpdate(action: BatchAction) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    try {
      const res = await fetch("/api/articles/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action })
      });
      const data = await readJson<{ updated: number }>(res);

      if (action === "delete") {
        setArticles((current) => current.filter((article) => !idSet.has(article.id)));
      } else if (action === "favorite") {
        setArticles((current) => current.map((article) => (idSet.has(article.id) ? { ...article, favorite: true } : article)));
      } else if (action === "unfavorite") {
        setArticles((current) => current.filter((article) => !idSet.has(article.id)));
      } else if (action === "mark-correct") {
        setArticles((current) => current.map((article) => (idSet.has(article.id) ? { ...article, crawlVerdict: "CORRECT" } : article)));
      } else if (action === "mark-rejected") {
        setArticles((current) => current.filter((article) => !idSet.has(article.id)));
      } else {
        setArticles((current) => current.map((article) => (idSet.has(article.id) ? { ...article, crawlVerdict: null } : article)));
      }

      setSelectedIds(new Set());
      setStatus(`已批量更新 ${data.updated} 条标题`);
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
  const allSelected = articles.length > 0 && selectedIds.size === articles.length;
  const selectedCount = selectedIds.size;
  const progressPercent = refreshProgress
    ? refreshProgress.totalFeeds === 0
      ? refreshProgress.stage === "completed" ? 100 : 0
      : Math.round((refreshProgress.completedFeeds / refreshProgress.totalFeeds) * 100)
    : 0;

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

      {mode === "today" && refreshProgress ? (
        <div className="refresh-progress" aria-live="polite" aria-atomic="true">
          <div className="refresh-progress-head">
            <strong>
              {refreshProgress.stage === "completed"
                ? "抓取完成"
                : refreshProgress.currentFeed
                  ? `正在抓取：${refreshProgress.currentFeed.name}`
                  : "正在准备抓取..."}
            </strong>
            <span>{progressPercent}%</span>
          </div>
          <progress
            className="refresh-progress-bar"
            max={100}
            value={progressPercent}
            aria-label="网站抓取进度"
          />
          <div className="refresh-progress-stats">
            <span>本次新增 {refreshProgress.created} 条</span>
            <span>已完成 {refreshProgress.completedFeeds}/{refreshProgress.totalFeeds} 个网站</span>
            <span>剩余 {refreshProgress.remainingFeeds} 个网站</span>
          </div>
        </div>
      ) : null}

      <div className="batch-row">
        <button className="button secondary" onClick={toggleSelectAll} disabled={articles.length === 0}>
          {allSelected ? "取消全选" : "全选当前列表"}
        </button>
        <span className="batch-count">已选 {selectedCount} 条</span>
        {mode !== "favorites" ? (
          <>
            <button className="button secondary" onClick={() => batchUpdate("mark-correct")} disabled={selectedCount === 0}>
              <CheckCircle2 size={16} />
              标记抓取正确
            </button>
            <button className="button secondary feedback-reject" onClick={() => batchUpdate("mark-rejected")} disabled={selectedCount === 0}>
              <XCircle size={16} />
              标记不应抓取
            </button>
            <button className="button secondary" onClick={() => batchUpdate("favorite")} disabled={selectedCount === 0}>
              <Star size={16} />
              批量收藏
            </button>
            <button className="button secondary" onClick={() => batchUpdate("delete")} disabled={selectedCount === 0}>
              <Trash2 size={16} />
              批量删除
            </button>
          </>
        ) : (
          <button className="button secondary" onClick={() => batchUpdate("unfavorite")} disabled={selectedCount === 0}>
            <StarOff size={16} />
            批量取消收藏
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
          <div className="article-title-row">
            <input
              type="checkbox"
              checked={selectedIds.has(article.id)}
              onChange={() => toggleArticleSelection(article.id)}
              aria-label={`选择 ${article.title}`}
            />
            <div>
            <a className="article-title" href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
            {article.translatedTitle && <div className="translated-title">{article.translatedTitle}</div>}
            <div className="meta">
              <span>{article.source}</span>
              <span>{formatPublishedAt(article)}</span>
              {article.crawlVerdict === "CORRECT" ? <span className="feedback-correct-label">已确认抓取正确</span> : null}
            </div>
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
        <div className="article-actions">
          {mode !== "favorites" ? (
            <>
              <button
                className={article.crawlVerdict === "CORRECT" ? "button feedback-correct" : "button secondary"}
                onClick={() => updateArticle(article.id, { crawlVerdict: article.crawlVerdict === "CORRECT" ? null : "CORRECT" })}
                title={article.crawlVerdict === "CORRECT" ? "取消正确标记" : "标记为抓取正确"}
              >
                <CheckCircle2 size={16} />
                {article.crawlVerdict === "CORRECT" ? "已确认正确" : "抓取正确"}
              </button>
              <button
                className="button secondary feedback-reject"
                onClick={() => updateArticle(article.id, { crawlVerdict: "REJECTED" })}
                title="标记为不应抓取并隐藏"
              >
                <XCircle size={16} />
                不应抓取
              </button>
            </>
          ) : null}
          <button className="button secondary delete-article-button" onClick={() => deleteArticle(article.id)} title="删除">
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </article>
    );
  }
}
