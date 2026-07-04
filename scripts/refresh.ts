import { refreshFeeds } from "../lib/rss";

refreshFeeds()
  .then((result) => {
    console.log(`Checked ${result.checkedFeeds} feeds, created ${result.created} articles.`);
    if (result.errors.length) {
      console.error(JSON.stringify(result.errors, null, 2));
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
