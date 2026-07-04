import { ArticleList } from "@/components/ArticleList";

export default function FavoritesPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">收藏夹</h2>
          <p className="page-desc">沉淀值得跟进的标题，并补充人工备注。</p>
        </div>
      </div>
      <ArticleList mode="favorites" />
    </>
  );
}
