const Parser = require('rss-parser');
const parser = new Parser();
const cheerio = require('cheerio');
const fs = require('fs/promises');
const weekly = 'weekly/index.html';
const daily = 'daily/index.html';
const opmlFeeds = 'data/feeds-in-progress.opml';

async function translateOPML(opmlPath) {
    const opml = await fs.readFile(opmlPath, 'utf-8');
    const $ = cheerio.load(opml, {xml: true});
    const title = $('head > title').text();
    const feeds = {};
    $('body > outline').each((i, elem) => {
        feeds[$(elem).attr('text')] = [];
        $(elem).find('outline').each((n, subElem) => {
            feeds[$(elem).attr('text')].push(
                $(subElem).attr('xmlUrl')
            );
        })
    });
    return [title, feeds];
}

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

            } catch(err) {
                console.log(`Failed to fetch: ${url}`);
                console.log(err.message)
                continue;
            }
            if (feed) {
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
                    .slice(0, count+1)
                    .map((post) => {
                        const posted = new Date(post.pubDate);
                        const recency = `${posted.getDate()}/${posted.getMonth()+1}`
                        return {
                            postTitle: post.title || 'Untitled Post',
                            postLink: post.link,
                            postRecency: recency,
                        }
                    });
                const site = {
                    siteTitle: feed.title || feed.link,
                    siteLink: feed.link || feed.feedUrl,
                    posts: posts,
                };
                if (site.posts.length > count) {
                    site.posts.push({
                        postTitle: 'more',
                        postLink: site.siteLink,
                        postRecency: 'more',
                    });
                }
                if (site.posts.length > 0) {
                    allFeeds[key].push(site);
                }
                console.log(`Fetched: ${url}`);
                numOfValidFeeds++;
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

async function updateHTML(htmlPath, feedsTitle, feedsInput, age, count) {
    const posts = await getFeeds(feedsInput, age, count);
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const todayDate = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const pageTitle = $('h1', '#tgw-heading');
    const updateDate = $('p.issue-info.date');
    const nav = $('#nav > ul');
    const content = $('#content');
    pageTitle.empty();
    updateDate.empty();
    nav.empty();
    content.empty();
    pageTitle.append(`${feedsTitle}`);
    updateDate.append(`${todayDate}`);
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
                if (post.postRecency === 'more') {
                    feedPosts = feedPosts + `
                        <li class="post more-posts">
                            <a href="${post.postLink}">
                                <div class="post-title">${post.postTitle}</div>
                            </a>
                        </li>
                    `
                } else {
                    feedPosts = feedPosts + `
                        <li class="post">
                            <a href="${post.postLink}">
                                <div class="post-title">${post.postTitle}</div>
                                <div class="recency">${post.postRecency}</div>
                            </a>
                        </li>
                    `
                }
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

async function buildTheGoodWeb({ runDaily = false, runWeekly = true } = {}) {
    const [feedsTitle, feedsInput] = await translateOPML(opmlFeeds);
    if (runDaily) {
        try {
            console.log('Updating daily...');
            await updateHTML(daily, feedsTitle, feedsInput, 2, 5);
        } catch(err) {
            console.log('Daily tried and failed.');
            console.log(err.message);
        }
    }
    if (runWeekly) {
        try {
            console.log('Updating weekly...');
            await updateHTML(weekly, feedsTitle, feedsInput, 8, 5);
        } catch(err) {
            console.log('Weekly tried and failed.');
            console.log(err.message);
        } 
    }
    process.exit(0);
}

buildTheGoodWeb({runDaily: true});