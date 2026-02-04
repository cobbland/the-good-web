![](/images/icon128.png)

# The Good Web

An introduction and step-by-step guide to actually using the world wide web, and an opinionated collection of feeds.

## Installation

- Clone repo
- Run `npm install`
- Optionally replace `data/feeds.opml` with your own collection of feeds
- Optionally set `weeklyEditionDay` in `scripts/goToPrint.js`
- Run `npm run fetch` to get feeds
- Deploy to static web host
- Run `npm run fetch` to update

## To Do

- [ ] Write docs
- [ ] When doing both a daily and a weekly fetch, reuse data from weekly to populate daily?
- [ ] Add timeout to fetching feeds ([Promise.race()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)?)
- [ ] Finish main page
- [ ] Finish "opinionated" page
- [ ] Make good default opml
- [ ] Fix updating title to also update title in head
- [ ] Add more sizes of favicons