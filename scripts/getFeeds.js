const Parser = require('rss-parser');
const parser = new Parser();
const cheerio = require('cheerio');
const fs = require('fs/promises');
const weekly = 'weekly/index.html';
const daily = 'daily/index.html';
const opmlFeeds = 'data/feeds.opml';

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
    let failedFeeds = [];
    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() - age);
    const timeout = (ms) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('Timeout')), ms);
        });
    };
    for (const key of Object.keys(feedsInput)) {
        allFeeds[key] = [];
        for (const url of feedsInput[key]) {
            let feed = false;
            try {
                feed = await Promise.race([
                    parser.parseURL(url),
                    timeout(10000)
                ]);
            } catch(err) {
                failedFeeds.push(url);
                console.log(`Failed to fetch: ${url}`);
                console.log(err.message)
                continue;
            }
            if (feed) {
                const posts = feed.items
                    .filter((post) => {
                        const postDate = new Date(post.pubDate);
                        return postDate.getTime() >= (toDate.getTime() - 3600000);
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
    console.log(`Failed to fetch ${failedFeeds.length} feeds.`)
    for (const topic of Object.keys(allFeeds)) {
        allFeeds[topic].sort((a, b) => a.siteTitle.localeCompare(b.siteTitle));
    }
    return { allFeeds, failedFeeds };
}

async function updateHTML(htmlPath, feedsTitle, feedsInput, age, count) {
    const { allFeeds, failedFeeds } = await getFeeds(feedsInput, age, count);
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const todayDate = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const headTitle = $('title');
    const pageTitle = $('h1 > a', '#tgw-heading');
    const updateDate = $('p.issue-info.date');
    const nav = $('#nav > ul');
    const content = $('#content');
    const failed = $('#failed');
    headTitle.empty();
    pageTitle.empty();
    updateDate.empty();
    nav.empty();
    content.empty();
    failed.empty();
    if (age <= 3) {
        headTitle.append(`${feedsTitle} | Daily`);
    } else {
        headTitle.append(`${feedsTitle} | Weekly`);
    }
    pageTitle.append(`${feedsTitle}`);
    updateDate.append(`${todayDate}`);
    Object.keys(allFeeds).forEach((topic) => {
        nav.append(`
            <li><a href="#${topic}">${topic}</a></li>
        `);
        content.append(`
            <div id="${topic}" class="topic">
                <h2><a href="#top">${topic}</a></h2>
                <div class="feeds">

                </div>
            </div>
        `);
        const feeds = $(`#${topic} > .feeds`);
        allFeeds[topic].forEach((feed) => {
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
    if (failedFeeds.length > 0) {
        failed.append(`
            <p>Failed sources:</p>
            <ul></ul>    
        `)
        failedFeeds.forEach((failedFeed) => {
            $('ul', '#failed').append(`
                <li><a href="${failedFeed}">${failedFeed}</a></li>    
            `)
        });
    }
    await fs.writeFile(htmlPath, $.html(), 'utf-8');
}

async function buildTheGoodWeb({ runDaily = true, runWeekly = false } = {}) {
    const [feedsTitle, feedsInput] = await translateOPML(opmlFeeds);
    if (runDaily) {
        try {
            console.log('Updating daily...');
            await updateHTML(daily, feedsTitle, feedsInput, 1, 5);
        } catch(err) {
            console.log('Daily tried and failed.');
            console.log(err.message);
        }
    }
    if (runWeekly) {
        try {
            console.log('Updating weekly...');
            await updateHTML(weekly, feedsTitle, feedsInput, 7, 5);
        } catch(err) {
            console.log('Weekly tried and failed.');
            console.log(err.message);
        } 
    }
    process.exit(0);
}

module.exports = { buildTheGoodWeb };