const Parser = require('rss-parser');
const parser = new Parser();
const cheerio = require('cheerio');
const fs = require('fs/promises');
const weekly = 'weekly/index.html';
const daily = 'daily/index.html';
const feeds = {
    blogs: [
        'https://blog.saisarida.com/feed.xml',
        'https://julia.densford.net/feed.xml',
    ],
    news: [
        'https://feeds.npr.org/1001/rss.xml',
        'https://www.aljazeera.com/xml/rss/all.xml',
    ],
    me: [
        'https://cobb.land/feed.xml',
    ],
};

async function getFeeds(feedsInput, age, count) {
    let allFeeds = {};
    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() - age);
    for (const key of Object.keys(feedsInput)) {
        allFeeds[key] = [];
        for (const url of feedsInput[key]) {
            const feed = await parser.parseURL(url);
            const posts = feed.items
                .filter((post) => {
                    const postDate = new Date(post.pubDate);
                    return postDate.getTime() >= toDate.getTime();
                })
                .sort((a, b) => {
                    const firstDate = new Date(a.pubDate);
                    const secondDate = new Date(b.pubDate);
                    return secondDate.getTime() - firstDate.getTime();
                })
                .slice(0, count)
                .map((post) => {
                    return {
                        postTitle: post.title || 'Untitled Post',
                        postLink: post.link
                    }
                });
            const site = {
                siteTitle: feed.title || feed.link,
                siteLink: feed.link || feed.feedUrl,
                posts: posts,
            };
            if (site.posts.length > 0) {
                allFeeds[key].push(site);
            }
        }
    }
    for (const topic of Object.keys(allFeeds)) {
        if (allFeeds[topic].length <= 0) {
            delete allFeeds[topic];
        }
    }
    return allFeeds;
}

async function updateHTML(htmlPath, feedsInput, age, count) {
    const posts = await getFeeds(feedsInput, age, count);
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const nav = $('#nav > ul');
    const content = $('#content');
    nav.empty();
    content.empty();
    Object.keys(posts).forEach((topic) => {
        nav.append(`
            <li><a href="#${topic}">${topic}</a></li>
        `);
        content.append(`
            <div id="${topic}" class="topic">
                <h2><a href="#the-good-web">${topic}</a></h2>
                <div class="feeds">

                </div>
            </div>
        `);
        const feeds = $(`#${topic} > .feeds`);
        posts[topic].forEach((feed) => {
            let feedPosts = ``;
            feed.posts.forEach((post) => {
                feedPosts = feedPosts + `
                    <li class="post">
                        <a href="${post.postLink}">
                            ${post.postTitle}
                        </a>
                    </li>
                `
            });
            feeds.append(`
                <div class="feed">
                    <h3 class="feed-name">
                        <a href="${feed.siteLink}">${feed.siteTitle}</a>
                    </h3>
                    <ul class="posts">
                        ${feedPosts}
                    </ul>
                </div>
            `);
        });
    });
    await fs.writeFile(htmlPath, $.html(), 'utf-8');
}

updateHTML(weekly, feeds, 8, 5);
updateHTML(daily, feeds, 2, 5);