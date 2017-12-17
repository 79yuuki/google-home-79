const cron = require('cron').CronJob;
const googlehome = require('google-home-notifier');
const request = require('superagent');

const cronTime = "1 * * * * *"; // every 1 min
const language = 'ja';

const checkRate = 1.5;
const checkMin = 15; // must over 2
const stopMin = 30;

let rateHistory = {
  btc: [],
  xem: [],
  xrp: [],
  eth: [],
  bch: []
};

googlehome.device('Google-Home', language);

googlehome.notify('ちんぽ', function(res) {
  console.log(res);
});

const getData = (currency) => {
  const url = `https://coincheck.com/api/rate/${currency}_jpy`;
  return new Promise((resolve, reject) => {
    request.get(url)
    .end((err, res) => {
      if (err) {
        return reject(err);
      }
      rateHistory[currency].push(res.body.rate - 0);
      return resolve();
    });
  });
};

let notifyCache = {};
const checkRates = () => {
  let notifications = [];
  Object.keys(rateHistory).forEach((k) => {
    const history = rateHistory[k];
    if (notifyCache[k] && notifyCache[k] > 0) {
      notifyCache[k]--;
      console.log(notifyCache);
      return;
    }
    if (history.length < checkMin) {
      return;
    }
    rateHistory[k].shift();
    let count = history.length > checkMin ? checkMin : history.length;
    let low;
    let lowIndex = 0;
    let high;
    let highIndex = 0;
    for (let i = 0; i < count; i++) {
      let rate = history[i];
      if (!low || low > rate) {
        low = rate;
        lowIndex = i;
      }
      if (!high || high < rate) {
        high = rate;
        highIndex = i;
      }
    }

    let plus = true;
    if (lowIndex > highIndex) {
      plus = false;
    }
    console.log('>>>>high', high, 'low', low, 'change', Math.floor(high / low * 100) / 100, plus);
    if (high / low < checkRate) {
      return;
    }
    let fluctuation = Math.floor(high / low * 100) / 100
    let sign = plus ? '高騰' : '下落';
    const voice = `${k}が${fluctuation}パーセント${sign}しました`;
    notifications.push(voice);
    console.log(voice);
    notifyCache[k] = stopMin; // 30min 通知しない
  });
  return notifications;
};

const getRates = () => {
  Promise.all(Object.keys(rateHistory).map((k) => {
    return getData(k);
  }))
  .then(() => {
    console.log('===', rateHistory);
    return checkRates();
  })
  .then((notifications) => {
    console.log('notify>>>>>>', notifications);
    if (!notifications || notifications.length === 0) { return; }
    const notify = () => {
      googlehome.notify(notifications.shift(), () => {
        if (notifications.length > 0) {
          setTimeout(() => {
            notify();
          }, 9000);
        }
      });
    };
    notify();
  });
};

getRates();
const job = new cron({
  cronTime: cronTime,

  onTick: () => {
    getRates();
  },

  onComplete: () => {
  },

  start: false,

  timeZone: 'Asia/Tokyo'
});

job.start();

