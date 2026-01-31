const Parser = require('rss-parser');
let parser = new Parser();
// const feeds = [
//     'https://densford.net/rss.xml',
//     'https://cobb.land/feed.xml',
//     'https://thinkygames.com/feed/atom/',
//     'https://patchworkpaladin.com/feed/',
//     'https://www.sabregamesandcards.com/blog-feed.xml',
//     'https://seedofworlds.blogspot.com/feeds/posts/default',
//     'https://ttrpg.in/feed/',
//     'https://idlecartulary.substack.com/feed',
//     'https://questingbeast.substack.com/feed',
//     'https://gardinerbryant.com/rss/',
//     'https://slyflourish.com/index.xml#feed',
//     'https://www.privacyguides.org/rss/',
//     'https://kill-the-newsletter.com/feeds/9px5rl1ftct41katelbe.xml',
//     'https://going-medieval.com/feed/',
//     'https://www.brandonsanderson.com/blogs/blog.atom',
//     'https://bigfriendly.guide/feed/',
//     'https://kill-the-newsletter.com/feeds/8c8utgynkgsjn90pv6cc.xml',
//     'https://legiblenews.com/daily/feeds/5776776a3a948f1035cbafcd09ca4421.rss',
//     'https://orbitalindex.com/feed.xml',
//     'https://xkcd.com/atom.xml',
//     'https://www.gamingonlinux.com/article_rss.php',
//     'https://reactormag.com/feed/',
//     'https://dndblogs.com/index.xml#feed',
//     'https://kill-the-newsletter.com/feeds/t5vo77yj1jwru2xvk1dx.xml',
//     'https://ttrpgfans.com/feed/',
// ];
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
                title: feed.title || feed.link,
                link: feed.link || feed.feedUrl,
                posts: posts,
            });
        }
    }
    return allFeeds;
}

getFeeds().then((result) => {
    console.log(result);
});