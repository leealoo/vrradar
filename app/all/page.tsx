import { ArticleList } from "@/components/ArticleList";

export default function AllPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">全部标题</h2>
          <p className="page-desc">浏览历史标题，按日期、公司、主题或关键词筛选。</p>
        </div>
      </div>
      <ArticleList mode="all" />
    </>
  );
}
