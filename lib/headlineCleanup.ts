import { planExistingHeadlineCleanup } from "./headlines";

export const invalidHeadlineCleanupKey = "cleanup.invalid-headlines.v1";

export type CleanupArticle = {
  id: string;
  title: string;
  link: string;
};

export type HeadlineCleanupStore = {
  hasCompleted(key: string): Promise<boolean>;
  listActiveArticles(): Promise<CleanupArticle[]>;
  repairArticle(id: string, title: string): Promise<void>;
  softDeleteArticle(id: string): Promise<void>;
  markCompleted(key: string, summary: { repaired: number; deleted: number }): Promise<void>;
};

export async function runInvalidHeadlineCleanupOnce(store: HeadlineCleanupStore) {
  if (await store.hasCompleted(invalidHeadlineCleanupKey)) {
    return { repaired: 0, deleted: 0, skipped: true };
  }

  let repaired = 0;
  let deleted = 0;
  for (const article of await store.listActiveArticles()) {
    const decision = planExistingHeadlineCleanup(article.title, article.link);
    if (decision.action === "repair") {
      await store.repairArticle(article.id, decision.title);
      repaired += 1;
    } else if (decision.action === "delete") {
      await store.softDeleteArticle(article.id);
      deleted += 1;
    }
  }

  await store.markCompleted(invalidHeadlineCleanupKey, { repaired, deleted });
  return { repaired, deleted, skipped: false };
}
