const { Telegraf } = require("telegraf");
const bot = new Telegraf(process.env.BOT_TOKEN);

global.fetch = require("node-fetch");
const wretch = require("wretch");

const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_SECRET });
const databaseId = process.env.NOTION_DATABASE_ID;

bot.start(ctx => ctx.reply("All good"));

// NOTE: Make sure the previous bot is cleaned up, then launch one
bot.telegram.deleteWebhook().then(() => bot.launch());

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

setInterval(findNewLinksToShare, 60000)

async function findNewLinksToShare() {
  console.log("\nFetching links from Notion DB...");
  const linksToPublish = await getLinksToPublishFromNotionDatabase();

  for (const link of linksToPublish) {
    let message = link.tags.join(" ");
    message += "\r\n\r\n";
    message += link.description;
    message += "\r\n\r\n";
    message += link.url;

    // Send to Telegram
    bot.telegram
      .sendMessage("@sonny_ad", message)
      .then(() => updateSharedLink(link.id));

    // Send to Twitter
    await wretch().url(process.env.TWITTER_POST_URL)
      .post({"message": message})
      .res(response => console.log);
  }
}

async function getLinksToPublishFromNotionDatabase() {
  const links = [];
  let cursor = undefined;

  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: "On Telegram?", checkbox: { equals: true } },
          { property: "Shared", checkbox: { equals: false } }
        ]
      }
    });
    links.push(...results);
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  console.log(`${links.length} links successfully fetched.`);
  return links.map(link => {
    const url = link.properties["URL"].url;
    const description =
      link.properties["Description"].title.length > 0
        ? link.properties["Description"].title[0].plain_text
        : "";
    const tags = link.properties["Tags"].multi_select.map(
      tag => "#" + tag.name
    );

    return {
      id: link.id,
      url: url,
      description: description,
      tags: tags
    };
  });
}

async function updateSharedLink(id) {
  const result = await notion.pages.update({
    page_id: id,
    properties: {
      Shared: { checkbox: true }
    }
  });
  try {
    if (result.properties.Shared.checkbox == false)
      throw new Error('Notion database update failed')
  }
  catch(e) {
    console.error(e);
    throw e
  }
}
