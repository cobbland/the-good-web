const Parser = require('rss-parser');
const parser = new Parser();
const cheerio = require('cheerio');
const fs = require('fs/promises');
const page = 'weekly/index.html';
const feeds = {
    blogs: [
        'https://cobb.land/feed.xml',
    ]
};

async function getFeeds(feedsInput = feeds, age = 7, count = 6) {
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
                        postTitle: post.title || post.link,
                        postLink: post.link
                    }
                });
            allFeeds[key].push({
                siteTitle: feed.title || feed.link,
                siteLink: feed.link || feed.feedUrl,
                posts: posts,
            });
        }
    }
    return allFeeds;
}

async function updateHTML(htmlPath = page) {
    const posts = await getFeeds();
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const nav = $('#nav > ul');
    const content = $('#content');
    nav.empty();
    content.empty();
    Object.keys(posts).forEach(key => {
        nav.append(`
            <li><a href="#${key}">${key}</a></li>
        `);
        content.append(`
            <div id="${key}" class="topic">
                <h2><a href="#the-good-web">${key}</a></h2>
                <div class="feeds">

                </div>
            </div>
        `)
        const feeds = $(`#${key} > .feeds`);
        // iterate through posts an append to feeds above
    })
}

updateHTML();