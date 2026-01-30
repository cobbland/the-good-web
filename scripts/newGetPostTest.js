const Parser = require('rss-parser');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { parseString } = require('xml2js');
const { promisify } = require('util');

const parseXml = promisify(parseString);
const parser = new Parser({
  customFields: {
    item: ['description', 'content:encoded', 'summary']
  },
  timeout: 10000
});

// Helper function to check if post is from today
function isToday(date) {
  const today = new Date();
  const postDate = new Date(date);
  return postDate.toDateString() === today.toDateString();
}

// Helper function to format date nicely
function formatDate(date) {
  const d = new Date(date);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = d.toLocaleDateString('en-US', options);
  const day = d.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 != 10) * day % 10];
  return formatted.replace(day.toString(), `${day}${suffix} of`);
}

// Parse OPML file
async function parseOPML(opmlPath) {
  try {
    const opmlContent = await fs.readFile(opmlPath, 'utf8');
    const result = await parseXml(opmlContent);
    
    const feeds = [];
    const categories = new Set();
    
    // Navigate OPML structure
    const body = result.opml.body[0];
    
    if (body.outline) {
      body.outline.forEach(outline => {
        // Check if this is a category with nested feeds
        if (outline.outline && outline.outline.length > 0) {
          const category = (outline.$.title || outline.$.text || 'other').toLowerCase();
          categories.add(category);
          
          outline.outline.forEach(feed => {
            if (feed.$.xmlUrl) {
              feeds.push({
                name: feed.$.title || feed.$.text || 'Untitled Feed',
                url: feed.$.xmlUrl,
                htmlUrl: feed.$.htmlUrl || '',
                category: category
              });
            }
          });
        } 
        // Direct feed without category
        else if (outline.$.xmlUrl) {
          categories.add('other');
          feeds.push({
            name: outline.$.title || outline.$.text || 'Untitled Feed',
            url: outline.$.xmlUrl,
            htmlUrl: outline.$.htmlUrl || '',
            category: 'other'
          });
        }
      });
    }
    
    return { feeds, categories: Array.from(categories).sort() };
  } catch (error) {
    console.error('Error parsing OPML:', error);
    throw error;
  }
}

// Fetch and parse a single feed
async function fetchFeed(feedInfo) {
  try {
    console.log(`Fetching ${feedInfo.name}...`);
    const feed = await parser.parseURL(feedInfo.url);
    console.log(`✓ ${feedInfo.name} (${feed.items.length} items)`);
    return {
      ...feedInfo,
      title: feed.title || feedInfo.name,
      link: feed.link || feedInfo.htmlUrl,
      items: feed.items.slice(0, 15).map(item => ({
        // Handle title being an object or string
        title: typeof item.title === 'string' ? item.title : (item.title?._ || item.title?.toString() || 'Untitled'),
        link: item.link || '#',
        pubDate: item.pubDate,
        isToday: isToday(item.pubDate)
      }))
    };
  } catch (error) {
    console.error(`✗ Error fetching ${feedInfo.name}:`, error.message);
    return null;
  }
}

// Fetch all feeds
async function fetchAllFeeds(feedList) {
  const results = await Promise.all(feedList.map(fetchFeed));
  return results.filter(feed => feed !== null);
}

// Generate HTML for a single feed
function generateFeedHTML(feed) {
  let html = `
                    <div class="feed">
                        <h3 class="feed-name"><a href="${feed.link || ''}" target="_blank" rel="noopener">${feed.title || 'Untitled'}</a></h3>
                        <ul class="posts">`;

  feed.items.forEach(item => {
    const postClass = item.isToday ? ' today' : '';
    // Ensure title is a string
    const title = typeof item.title === 'string' ? item.title : (item.title?._ || item.title?.toString() || 'Untitled');
    const link = item.link || '#';
    html += `
                            <li class="post${postClass}"><a href="${link}" target="_blank" rel="noopener">${title}</a></li>`;
  });

  html += `
                        </ul>
                    </div>`;

  return html;
}

// Generate navigation HTML
function generateNavHTML(categories) {
  const navItems = ['top', ...categories];
  return navItems.map(cat => {
    const displayName = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `                <li><a href="#${cat}">${displayName}</a></li>`;
  }).join('\n');
}

// Generate content sections HTML
function generateContentHTML(feeds, categories) {
  let html = '';
  
  // Top section - most recently updated feeds
  html += `
            <div id="top" class="topic">
                <h2>Top</h2>
                <div class="feeds">`;
  
  const feedsByRecent = [...feeds].sort((a, b) => {
    const aLatest = new Date(a.items[0]?.pubDate || 0);
    const bLatest = new Date(b.items[0]?.pubDate || 0);
    return bLatest - aLatest;
  });

  feedsByRecent.slice(0, 10).forEach(feed => {
    html += generateFeedHTML(feed);
  });
  
  html += `
                </div>
            </div>`;

  // Category sections
  categories.forEach(category => {
    const categoryFeeds = feeds.filter(feed => feed.category === category);
    if (categoryFeeds.length === 0) return;

    html += `
            <div id="${category}" class="topic">
                <h2><a href="#the-good-web">${category.charAt(0).toUpperCase() + category.slice(1)}</a></h2>
                <div class="feeds">`;

    categoryFeeds.forEach(feed => {
      html += generateFeedHTML(feed);
    });

    html += `
                </div>
            </div>`;
  });

  return html;
}

// Update or create HTML file
async function updateHTML(feeds, categories, outputPath) {
  const today = new Date();
  const dateString = formatDate(today);
  
  const navHTML = generateNavHTML(categories);
  const contentHTML = generateContentHTML(feeds, categories);
  
  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Good Web</title>
    <link rel="stylesheet" href="styles/styles.css">
</head>
<body>

    <section id="the-good-web">
        <div id="tgw-heading">
            <p class="issue-info date">
                ${dateString}
            </p>
            <div>
                <div id="editions"><a href="/daily">Daily</a> | <a href="/weekly" class="selected">Weekly</a></div>
                <h1>The Good Web</h1>
            </div>
            <p class="issue-info info">
                An <a href="/opinionated">opinionated</a> collection of <a href="/feeds">feeds</a>
            </p>
        </div>
        <div id="nav">
            <ul>
${navHTML}
            </ul>
        </div>
        <div id="content">
${contentHTML}
        </div>
    </section>
    

</body>
</html>`;

  await fs.writeFile(outputPath, fullHTML, 'utf8');
}

// Main function
async function main() {
  const opmlPath = process.argv[2] || path.join(__dirname, 'feeds.opml');
  const outputPath = path.join(__dirname, 'index.html');
  
  console.log('Starting feed aggregation...\n');
  console.log(`Reading OPML from: ${opmlPath}\n`);
  
  try {
    // Parse OPML
    const { feeds: feedList, categories } = await parseOPML(opmlPath);
    console.log(`Found ${feedList.length} feeds in ${categories.length} categories\n`);
    
    // Fetch all feeds
    const feeds = await fetchAllFeeds(feedList);
    console.log(`\nSuccessfully fetched ${feeds.length} feeds\n`);
    
    // Update HTML
    await updateHTML(feeds, categories, outputPath);
    
    console.log(`✓ Generated ${outputPath}`);
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();