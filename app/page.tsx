import { ArticleList } from "@/components/ArticleList";

export default function TodayPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">今日更新</h2>
          <p className="page-desc">显示3天内的抓取记录，新增排在最前。</p>
        </div>
      </div>
      <ArticleList mode="today" />
    </>
  );
}
