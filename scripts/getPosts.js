const Parser = require('rss-parser');
const cheerio = require('cheerio');
const fs = require('fs/promises');
const parser = new Parser();
const page = 'index.html';
const feeds = [
    'https://densford.net/rss.xml',
    'https://cobb.land/feed.xml',
    'https://thinkygames.com/feed/atom/',
    'https://patchworkpaladin.com/feed/',
    'https://www.sabregamesandcards.com/blog-feed.xml',
    'https://seedofworlds.blogspot.com/feeds/posts/default',
    'https://ttrpg.in/feed/',
    'https://idlecartulary.substack.com/feed',
    'https://questingbeast.substack.com/feed',
    'https://gardinerbryant.com/rss/',
    'https://slyflourish.com/index.xml#feed',
    'https://www.privacyguides.org/rss/',
    'https://kill-the-newsletter.com/feeds/9px5rl1ftct41katelbe.xml',
    'https://going-medieval.com/feed/',
    'https://ln.ht/_/feed/~cobbland',
    'https://www.brandonsanderson.com/blogs/blog.atom',
    'https://bigfriendly.guide/feed/',
    'https://kill-the-newsletter.com/feeds/8c8utgynkgsjn90pv6cc.xml',
    'https://legiblenews.com/daily/feeds/5776776a3a948f1035cbafcd09ca4421.rss',
    'https://orbitalindex.com/feed.xml',
    'https://xkcd.com/atom.xml',
    'https://www.gamingonlinux.com/article_rss.php',
    'https://reactormag.com/feed/',
    'https://dndblogs.com/index.xml#feed',
    'https://kill-the-newsletter.com/feeds/t5vo77yj1jwru2xvk1dx.xml',
    'https://ttrpgfans.com',
];

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return "";
    }
}

function isWithinDaysFromToday(date, days) {
    const today = new Date();
    const dateInput = new Date(date);

    // Normalize both dates to midnight to avoid time-of-day issues
    today.setHours(0, 0, 0, 0);
    dateInput.setHours(0, 0, 0, 0);

    const diffInMs = dateInput - today;
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    return diffInDays <= 0 && diffInDays >= -Math.abs(days);
}

function isWithinHours(date, hours) {
    const now = new Date();
    const dateInput = new Date(date);
    const diffInMs = now - dateInput;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    return diffInHours >= 0 && diffInHours <= hours;
}

async function fetchFeeds(feedsArray = feeds, entryCount = 12) {
    // Fetch all feeds with error handling for each
    const feedPromises = feedsArray.map(async (url) => {
        try {
            return await parser.parseURL(url);
        } catch (error) {
            console.error(`Failed to parse feed: ${url}`);
            console.error(`Error: ${error.message}`);
            return null; // Return null for failed feeds
        }
    });

    const allFeeds = await Promise.all(feedPromises);
    
    // Filter out null values (failed feeds)
    const validFeeds = allFeeds.filter(feed => feed !== null);
    
    console.log(`Successfully parsed ${validFeeds.length} out of ${feedsArray.length} feeds`);
    
    const allPosts = [];
    
    for (let site of validFeeds) {
        const domain = extractDomain(site.link || site.items[0]?.link);
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        const siteName = site.title || domain;
        
        // Filter items to only include posts from the last 7 days, then limit to entryCount
        let recentItems = site.items.filter(item => isWithinDaysFromToday(item.pubDate, 7));
        
        // If no posts in the last 7 days, get at least the most recent post
        if (recentItems.length === 0 && site.items.length > 0) {
            recentItems = [site.items[0]];
        } else {
            recentItems = recentItems.slice(0, entryCount);
        }
        
        const posts = recentItems.map((item) => {
            return {
                title: (item.title || 'Post').trim(),
                author: siteName,
                favicon: favicon,
                link: item.link,
                pubDate: new Date(item.pubDate || 0),
                class: isWithinHours(item.pubDate, 24) ? 'new-post' : 'old-post',
                source: site.title,
                sourceLink: site.link || site.items[0]?.link || "#",
                content: item['content:encoded'] || item.content || item.summary || '',
            }
        });
        
        allPosts.push(...posts);
    }
    
    // Sort all posts by date (newest first)
    allPosts.sort((a, b) => b.pubDate - a.pubDate);
    return allPosts;
}

async function updateHTML(htmlPath = page) {
    const posts = await fetchFeeds();
    const html = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const postsList = $("#posts-list");
    const postsUpdated = $("#posts-updated");
    postsList.empty();
    postsUpdated.empty();
    posts.forEach(post => {
        // Extract domain from the post's source link
        const domain = extractDomain(post.sourceLink);
        const specialDomains = ['cobb.land', 'densford.net'];
        const isSpecial = specialDomains.includes(domain);
        const specialClass = isSpecial ? 'special-post' : '';
        
        postsList.append(`
            <li class="${post.class} ${specialClass}">
                <div>
                    <a href="${post.link}" class="post-link">${post.title}</a>
                </div>
                <div class="post-meta">
                    <img src="${post.favicon}" alt="" class="favicon" onerror="this.style.display='none'">
                    <a href="${post.sourceLink}" class="source-link">${post.author}</a>
                </div>
            </li>
        `)
    });
    postsUpdated.append(`Last update: ${new Date().toString()}`);
    await fs.writeFile(htmlPath, $.html(), 'utf-8');
}

updateHTML()
    .then(() => {
        console.log('Updated RSS section!');
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(0);
    });

module.exports = { updateHTML };