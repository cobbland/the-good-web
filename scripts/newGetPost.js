const Parser = require('rss-parser');
const cheerio = require('cheerio');

// Define your feed sources organized by category
const feedConfig = {
  tech: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tech' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' }
  ],
  tabletop: [
    { name: 'Polygon Tabletop', url: 'https://www.polygon.com/rss/tabletop-games/index.xml', category: 'tabletop' },
    { name: 'Dicebreaker', url: 'https://www.dicebreaker.com/feed', category: 'tabletop' }
  ],
  games: [
    { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', category: 'games' },
    { name: 'IGN', url: 'https://feeds.ign.com/ign/all', category: 'games' }
  ],
  blogs: [
    { name: 'Daring Fireball', url: 'https://daringfireball.net/feeds/main', category: 'blogs' },
    { name: 'Kottke', url: 'https://feeds.kottke.org/main', category: 'blogs' }
  ],
  news: [
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'news' },
    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'news' }
  ]
};

const parser = new Parser({
  customFields: {
    item: ['description', 'content:encoded', 'summary']
  }
});

// Helper function to check if post is from today
function isToday(date) {
  const today = new Date();
  const postDate = new Date(date);
  return postDate.toDateString() === today.toDateString();
}

// Helper function to get excerpt from content
function getExcerpt(content, maxLength = 150) {
  if (!content) return '';
  const $ = cheerio.load(content);
  const text = $.text().trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Fetch and parse a single feed
async function fetchFeed(feedInfo) {
  try {
    const feed = await parser.parseURL(feedInfo.url);
    return {
      ...feedInfo,
      title: feed.title,
      link: feed.link,
      items: feed.items.slice(0, 10).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        isToday: isToday(item.pubDate),
        excerpt: getExcerpt(item.contentSnippet || item.description || item.summary)
      }))
    };
  } catch (error) {
    console.error(`Error fetching ${feedInfo.name}:`, error.message);
    return null;
  }
}

// Fetch all feeds
async function fetchAllFeeds() {
  const allFeeds = Object.values(feedConfig).flat();
  const results = await Promise.all(allFeeds.map(fetchFeed));
  return results.filter(feed => feed !== null);
}

// Generate HTML for feeds
function generateFeedsHTML(feeds) {
  const categories = ['tech', 'tabletop', 'games', 'blogs', 'news'];
  let html = '';

  // Top section - Recent posts from all feeds
  html += `<section id="top" class="feed-section">
    <h2 class="section-title">Top Stories</h2>`;
  
  const allPosts = feeds.flatMap(feed => 
    feed.items.map(item => ({ ...item, feedName: feed.title, feedLink: feed.link }))
  ).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 20);

  allPosts.forEach(post => {
    const todayClass = post.isToday ? ' today' : '';
    html += `
    <div class="feed${todayClass}">
      <h3 class="feed-name"><a href="${post.feedLink}" target="_blank">${post.feedName}</a></h3>
      <ul class="posts">
        <li class="post${todayClass}">
          <a href="${post.link}" target="_blank">${post.title}</a>
        </li>
      </ul>
    </div>`;
  });
  
  html += `</section>`;

  // Latest section - All today's posts
  html += `<section id="latest" class="feed-section">
    <h2 class="section-title">Latest (Today)</h2>`;
  
  const todayPosts = feeds.flatMap(feed => 
    feed.items.filter(item => item.isToday).map(item => ({ 
      ...item, 
      feedName: feed.title, 
      feedLink: feed.link 
    }))
  ).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  if (todayPosts.length === 0) {
    html += `<p>No posts from today yet.</p>`;
  } else {
    todayPosts.forEach(post => {
      html += `
      <div class="feed today">
        <h3 class="feed-name"><a href="${post.feedLink}" target="_blank">${post.feedName}</a></h3>
        <ul class="posts">
          <li class="post today">
            <a href="${post.link}" target="_blank">${post.title}</a>
          </li>
        </ul>
      </div>`;
    });
  }
  
  html += `</section>`;

  // Category sections
  categories.forEach(category => {
    const categoryFeeds = feeds.filter(feed => feed.category === category);
    if (categoryFeeds.length === 0) return;

    html += `<section id="${category}" class="feed-section">
      <h2 class="section-title">${category.charAt(0).toUpperCase() + category.slice(1)}</h2>`;

    categoryFeeds.forEach(feed => {
      const hasToday = feed.items.some(item => item.isToday);
      const feedClass = hasToday ? ' today' : '';

      html += `
      <div class="feed${feedClass}">
        <h3 class="feed-name"><a href="${feed.link}" target="_blank">${feed.title}</a></h3>
        <ul class="posts">`;

      feed.items.forEach(item => {
        const postClass = item.isToday ? ' today' : '';
        html += `
          <li class="post${postClass}">
            <a href="${item.link}" target="_blank">${item.title}</a>
          </li>`;
      });

      html += `
        </ul>
      </div>`;
    });

    html += `</section>`;
  });

  return html;
}

// Update navigation links
function updateNavigation() {
  const nav = document.querySelector('#nav ul');
  nav.innerHTML = `
    <li><a href="#top">Top</a></li>
    <li><a href="#latest">Latest</a></li>
    <li><a href="#tech">Tech</a></li>
    <li><a href="#tabletop">Tabletop</a></li>
    <li><a href="#games">Games</a></li>
    <li><a href="#blogs">Blogs</a></li>
    <li><a href="#news">News</a></li>
  `;
}

// Main function to load and display feeds
async function loadFeeds() {
  const feedsContainer = document.getElementById('feeds');
  feedsContainer.innerHTML = '<p>Loading feeds...</p>';

  try {
    const feeds = await fetchAllFeeds();
    const html = generateFeedsHTML(feeds);
    feedsContainer.innerHTML = html;
    updateNavigation();
  } catch (error) {
    console.error('Error loading feeds:', error);
    feedsContainer.innerHTML = '<p>Error loading feeds. Please try again later.</p>';
  }
}

// Run when DOM is loaded
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadFeeds);
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchAllFeeds, generateFeedsHTML, feedConfig };
}