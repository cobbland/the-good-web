const Parser = require('rss-parser');
const parser = new Parser();
const cheerio = require('cheerio');
const fs = require('fs/promises');
const weekly = 'weekly/index.html';
const daily = 'daily/index.html';
const opmlFeeds = 'data/feeds.opml'
// let feeds;
let title = 'The Good Web';
const feeds = {
    blogs: [
        'https://blog.saisarida.com/feed.xml',
        'https://julia.densford.net/feed.xml',
    ],
    news: [
        'https://www.aljazeera.com/xml/rss/all.xml',
    ],
    me: [
        'https://cobb.land/',
    ],
};

async function getFeeds(feedsInput, age, count) {
    console.log(`Fetching ${count} posts from each feed from the last ${age} days...`)
    let allFeeds = {};
    let numOfValidFeeds = 0;
    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() - age);
    for (const key of Object.keys(feedsInput)) {
        allFeeds[key] = [];
        for (const url of feedsInput[key]) {
            let feed = false;
            try {
                feed = await parser.parseURL(url);
                numOfValidFeeds++;
            } catch(err) {
                console.log(`Failed to fetch: ${url}`);
                console.log(err.message)
                continue;
            }
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
    console.log(`Fetched ${numOfValidFeeds} feeds.`)
    return allFeeds;
}

// async function translateOPML(opmlPath = opmlFeeds) {
//     const opml = await fs.readFile(opmlPath, 'utf-8');
//     const $ = cheerio.load(opml);
//     const newObject = {};
//     $(body > outline).each((i, elem) => {
//         newObject[]
//     })
// }

// translateOPML();

async function updateHTML(htmlPath, feedsInput, age, count) {
    const posts = await getFeeds(feedsInput, age, count);
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const pageTitle = $('h1', '#tgw-heading');
    const nav = $('#nav > ul');
    const content = $('#content');
    pageTitle.empty()
    nav.empty();
    content.empty();
    pageTitle.append(`${title}`)
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