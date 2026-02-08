const { buildTheGoodWeb } = require('./getFeeds');
const weeklyEditionDay = 0; // Sunday - Saturday : 0 - 6

async function goToPrint() {
    const today = new Date();
    const day = today.getDay();
    if (day === weeklyEditionDay) {
        buildTheGoodWeb({runWeekly: true});
    } else {
        buildTheGoodWeb();
    }
}

goToPrint();